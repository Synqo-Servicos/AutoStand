/**
 * ============================================================================
 * A REGRA ÚNICA DE COMPETÊNCIA DO MÓDULO FINANCEIRO
 * ============================================================================
 *
 * Enunciada uma vez, e só aqui:
 *
 *   **`payments.paid_at` guarda o INSTANTE ABSOLUTO em que o pagamento foi
 *   aprovado (coluna `timestamptz`); a competência desse pagamento é o mês
 *   desse instante convertido para `America/Sao_Paulo`, e essa conversão
 *   acontece exclusivamente neste módulo.**
 *
 * Por que a regra precisa existir por escrito: antes dela o módulo tinha três
 * opiniões simultâneas sobre em que mês um pagamento estava — o Postgres
 * gravava relógio de parede (`timestamp` sem tz, descartando o offset do MP),
 * o webhook às vezes escrevia UTC (`new Date().toISOString()` no fallback), e
 * a fila fiscal relia com `getUTCMonth()` depois de um `new Date()` local. Um
 * pagamento das 22h de 31/08 aparecia como agosto num lugar e setembro no
 * outro, e quem paga a conta disso é o contador, que emite NFS-e e apura DAS
 * na competência errada.
 *
 * As três consequências de uma segunda opinião, em ordem de dor:
 *  1. NFS-e emitida na competência errada (irreversível fora do sistema);
 *  2. base do DAS/RBT12 divergindo do Caixa exibido na mesma tela;
 *  3. reconciliação com faltante fantasma — oferecido todo mês, importando zero.
 *
 * Corolários que o resto do código pode assumir:
 *  - todo carimbo que atravessa a fronteira deste módulo é um instante COM
 *    offset explícito (`Z` ou `±HH:MM`). Carimbo sem offset é REJEITADO em vez
 *    de ganhar um fuso por omissão — ver `instanteMs`;
 *  - o recorte de um mês é sempre SEMIABERTO `[from, to)`, e `from`/`to` são
 *    instantes absolutos ancorados na meia-noite de São Paulo — ver
 *    `periodoDaCompetencia` e o tipo `PeriodoSemiaberto`;
 *  - ninguém mais chama `getUTCMonth`, `toISOString().slice(0, 7)` nem
 *    `new Date(str)` para decidir mês. Se precisar, chame daqui.
 *
 * Este módulo é PURO: sem banco, sem JSX, sem `auth`. É o que permite testar a
 * regra inteira sem subir Postgres nem navegador.
 */

/** O fuso que define a competência. Não é configurável: é onde a SYNQO apura. */
export const TZ_COMPETENCIA = "America/Sao_Paulo";

/**
 * Formato aceito de competência: `YYYY-MM`, mês entre 01 e 12 — o único
 * formato que `periodoDaCompetencia` entende.
 *
 * A aritmética de mês faz `Date.UTC(y, m - 1, 1)` sem validar nada: um valor
 * não numérico (`"abc"`) vira `Date.UTC(NaN, ...)` → `Invalid time value`
 * (RangeError, derruba a página com 500); um mês fora de 01–12 (`"2026-13"`)
 * não estoura — `Date.UTC` rola silenciosamente pro mês seguinte/anterior, e o
 * período calculado fica errado sem avisar ninguém. Validar antes evita as
 * duas coisas.
 */
const COMPETENCIA_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidCompetencia(value: string): boolean {
  return COMPETENCIA_RE.test(value);
}

/**
 * Normaliza um valor vindo de fora (searchParams, querystring digitada à
 * mão, histórico do navegador) para uma competência válida. Entrada
 * ausente ou fora do formato cai no `fallback` — nunca em erro (500) e
 * nunca num período calculado silenciosamente errado.
 *
 * Quem chama decide o fallback (tipicamente o mês corrente) — esta função
 * não sabe de fuso horário.
 */
export function normalizeCompetencia(
  raw: string | undefined | null,
  fallback: string,
): string {
  return raw && isValidCompetencia(raw) ? raw : fallback;
}

// ============================================================================
// Instante ← texto
// ============================================================================

/**
 * Um carimbo de data/hora COM offset obrigatório, com as faixas válidas no
 * próprio regex (mês 01–12, dia 01–31, hora 00–23...) para que `"2026-13-01"`
 * não vire um `Date.UTC` que rola em silêncio para o ano seguinte.
 *
 * Aceita as duas grafias que de fato circulam aqui:
 *  - ISO-8601 do Mercado Pago: `2026-08-31T22:00:00.000-03:00`;
 *  - o que o driver do Postgres devolve para `timestamptz`, que usa espaço no
 *    lugar do `T` e offset de 2 dígitos: `2026-09-01 01:00:00+00`.
 *
 * O offset é OBRIGATÓRIO (`Z`, `±HH`, `±HHMM` ou `±HH:MM`) — ver `instanteMs`.
 */
const INSTANTE_RE =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.(\d{1,9}))?(Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)$/i;

/** `Z` / `-03` / `-0300` / `-03:00` → minutos de deslocamento em relação a UTC. */
function offsetEmMinutos(offset: string): number {
  if (offset.toUpperCase() === "Z") return 0;
  const sinal = offset[0] === "-" ? -1 : 1;
  const corpo = offset.slice(1).replace(":", "");
  const horas = Number(corpo.slice(0, 2));
  const minutos = corpo.length > 2 ? Number(corpo.slice(2, 4)) : 0;
  return sinal * (horas * 60 + minutos);
}

/**
 * Instante absoluto (epoch ms) de um carimbo de data/hora. Devolve `null` para
 * o que não é um instante — e é aí que mora a proteção.
 *
 * **O offset é obrigatório, de propósito.** Um carimbo como
 * `"2026-08-31 22:00:00"` não designa instante nenhum: interpretá-lo como UTC
 * ou como São Paulo dá dois momentos diferentes, a 3 h de distância, e a
 * escolha errada joga o pagamento para a competência seguinte. Esse é o modo
 * de falha que não sinaliza nada — os dois lados da comparação "concordam",
 * porque os dois erraram igual. Recusar a leitura transforma um erro silencioso
 * de competência em um dado visivelmente ausente na tela, que alguém conserta.
 *
 * Também recusa data que não existe no calendário (`2026-02-30`), que
 * `Date.UTC` aceitaria rolando para março.
 */
export function instanteMs(valor: string): number | null {
  const m = INSTANTE_RE.exec(valor.trim());
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto, segundo, fracao, offset] = m;
  const ms = fracao ? Number(fracao.slice(0, 3).padEnd(3, "0")) : 0;
  const literal = Date.UTC(
    +ano, +mes - 1, +dia, +hora, +minuto, segundo ? +segundo : 0, ms,
  );
  // Data inexistente (31/02) rolaria para o mês seguinte sem reclamar.
  const conferencia = new Date(literal);
  if (
    conferencia.getUTCFullYear() !== +ano ||
    conferencia.getUTCMonth() !== +mes - 1 ||
    conferencia.getUTCDate() !== +dia
  ) {
    return null;
  }
  return literal - offsetEmMinutos(offset) * 60_000;
}

// ============================================================================
// Instante → calendário de São Paulo
// ============================================================================

/**
 * O único lugar do sistema que converte instante para calendário local. Usa
 * `Intl` com `timeZone` explícito em vez do fuso do processo: o mesmo instante
 * tem que dar a mesma competência na Vercel (UTC), na máquina de quem
 * desenvolve (Maceió) e no navegador do contador.
 */
const PARTES_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_COMPETENCIA,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

interface PartesLocais {
  ano: number; mes: number; dia: number;
  hora: number; minuto: number; segundo: number;
}

function partesEmSaoPaulo(instante: number): PartesLocais {
  const partes = PARTES_SP.formatToParts(new Date(instante));
  const ler = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  // Algumas versões do ICU devolvem "24" para a meia-noite com `hour12: false`.
  const hora = ler("hour") % 24;
  return {
    ano: ler("year"), mes: ler("month"), dia: ler("day"),
    hora, minuto: ler("minute"), segundo: ler("second"),
  };
}

function formatarCompetencia(ano: number, mes: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

/**
 * Competência (`YYYY-MM`) de um carimbo de pagamento — a função que o resto do
 * módulo chama em vez de fazer `getUTCMonth()` na mão.
 *
 * Devolve `null` quando o carimbo não designa um instante (ver `instanteMs`);
 * quem exibe mostra a ausência, nunca um mês chutado.
 */
export function competenciaDeInstante(valor: string): string | null {
  const ms = instanteMs(valor);
  if (ms === null) return null;
  const { ano, mes } = partesEmSaoPaulo(ms);
  return formatarCompetencia(ano, mes);
}

/**
 * Competência corrente, pelo relógio de São Paulo — o default do picker do
 * console financeiro.
 *
 * Nunca `new Date().toISOString().slice(0, 7)`: depois das 21h do dia 31 o UTC
 * já virou o mês seguinte, e o console abriria em um mês onde o Caixa está
 * vazio, a RBT12 vazia e o DAS zero — parecendo um mês sem faturamento em vez
 * de um erro de fuso.
 */
export function competenciaAtual(agora: Date = new Date()): string {
  const { ano, mes } = partesEmSaoPaulo(agora.getTime());
  return formatarCompetencia(ano, mes);
}

// ============================================================================
// Competência → janela de consulta
// ============================================================================

/**
 * Marca de tipo, sem existência em runtime (`declare`). Serve para uma coisa
 * só: impedir que um `{ from, to }` qualquer seja passado onde se espera um
 * recorte SEMIABERTO.
 *
 * O módulo já conviveu com duas convenções ao mesmo tempo — um `periodBounds`
 * semiaberto `[from, to)` e um `sumGrossBetween` inclusivo dos dois lados —, e
 * trocar um pelo outro somava o pagamento da virada do mês DUAS vezes na mesma
 * RBT12. As duas convenções foram unificadas em semiaberto; esta marca é o que
 * impede a segunda convenção de voltar por descuido, já que `{ from: string;
 * to: string }` é estruturalmente idêntico nos dois casos e o `tsc` não os
 * distinguiria sozinho.
 */
declare const MARCA_SEMIABERTO: unique symbol;

/** Recorte `[from, to)` de instantes absolutos. Só `periodoDaCompetencia` cria. */
export interface PeriodoSemiaberto {
  /** Primeiro instante DENTRO do período (inclusivo). ISO-8601 com offset. */
  readonly from: string;
  /** Primeiro instante FORA do período (exclusivo). ISO-8601 com offset. */
  readonly to: string;
  readonly [MARCA_SEMIABERTO]: true;
}

/**
 * Quanto São Paulo está deslocado de UTC no instante dado, em ms. Lido do
 * `Intl` em vez de fixado em `-03:00`: o Brasil já teve horário de verão e
 * pode voltar a ter, e um `-03:00` hardcoded erraria a virada do mês por uma
 * hora exatamente nos meses de transição.
 */
function deslocamentoSaoPauloMs(instante: number): number {
  const { ano, mes, dia, hora, minuto, segundo } = partesEmSaoPaulo(instante);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  // `partesEmSaoPaulo` não devolve milissegundos: compara no mesmo segundo.
  return comoSeFosseUtc - Math.floor(instante / 1000) * 1000;
}

/** Instante absoluto da meia-noite de São Paulo do 1º dia de `ano-mes`. */
function meiaNoiteEmSaoPaulo(ano: number, mes: number): number {
  const relogioLocal = Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0);
  // Duas passadas: a 1ª usa o deslocamento no instante errado (o relógio local
  // lido como UTC), a 2ª corrige usando o deslocamento no instante estimado.
  // Sem horário de verão as duas coincidem; com ele, a 2ª é a que vale.
  const primeiraAproximacao = relogioLocal - deslocamentoSaoPauloMs(relogioLocal);
  return relogioLocal - deslocamentoSaoPauloMs(primeiraAproximacao);
}

/**
 * Limites `[from, to)` de uma competência, como INSTANTES absolutos ancorados
 * na meia-noite de São Paulo.
 *
 * Para `2026-08` devolve `2026-08-01T03:00:00.000Z` → `2026-09-01T03:00:00.000Z`
 * — e não `00:00Z`, que recortaria o mês pela meia-noite de Londres e deixaria
 * as 21h–24h do dia 31 no mês errado.
 *
 * Semiaberto, sempre: o `to` é o `from` do mês seguinte, então um pagamento no
 * instante exato da virada pertence a exatamente um mês. É a mesma fronteira
 * que `competenciaDeInstante` enxerga — as duas concordam por construção, e há
 * teste amarrando isso.
 */
export function periodoDaCompetencia(competencia: string): PeriodoSemiaberto {
  if (!isValidCompetencia(competencia)) {
    throw new RangeError(`competência inválida: ${competencia}`);
  }
  const [ano, mes] = competencia.split("-").map(Number);
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  return {
    from: new Date(meiaNoiteEmSaoPaulo(ano, mes)).toISOString(),
    to: new Date(meiaNoiteEmSaoPaulo(proximoAno, proximoMes)).toISOString(),
  } as PeriodoSemiaberto;
}
