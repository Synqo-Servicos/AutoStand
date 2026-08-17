/**
 * Parsers de tipo do `pg` para colunas de data/hora.
 *
 * Isolado de `./client.ts` porque `client.ts` constrói um `Pool` no import —
 * o que torna a política de parsing impossível de testar sem simular um banco.
 * Aqui ela é uma função pura que recebe o registrador.
 */

/** `timestamp with time zone`. É o tipo de `payments.paid_at`. */
export const OID_TIMESTAMPTZ = 1184;

/**
 * Faz `timestamptz` chegar à aplicação como o TEXTO CRU do Postgres
 * (`2026-08-31 22:00:00-03`), em vez de passar por `Date`.
 *
 * Não é preferência de estilo — é o que impede a competência de escorregar 3 h
 * em silêncio. O caminho padrão é: `pg` converte para `Date`, e o drizzle
 * remonta a string em `PgTimestampString.mapFromDriverValue` escrevendo o
 * relógio de **UTC** (`value.toISOString()`) com o offset da **máquina**
 * (`value.getTimezoneOffset()`) colado no fim. Os dois pedaços vêm de fusos
 * diferentes: num host UTC o offset é `+00` e a string sai correta por
 * coincidência; num host `-03:00` sai o relógio de UTC rotulado `-03`, que
 * designa um instante 3 h adiante do real.
 *
 * Como a Vercel roda em UTC, esse bug não apareceria em produção — apareceria
 * em desenvolvimento, ou no dia em que a plataforma mudasse de fuso, e do jeito
 * mais caro possível: NFS-e emitida na competência errada. Com o parser
 * identidade o offset viaja dentro do dado e a leitura independe de onde o
 * processo roda.
 *
 * Só `payments.paid_at` é `timestamptz` no schema, então o alcance desta
 * política é exatamente uma coluna.
 */
export function registrarParsersDeData(
  setTypeParser: (oid: number, parser: (val: string) => unknown) => void,
): void {
  setTypeParser(OID_TIMESTAMPTZ, (val) => val);
}
