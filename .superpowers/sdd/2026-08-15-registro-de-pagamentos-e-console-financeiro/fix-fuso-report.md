# Correção da causa-raiz de fuso horário do módulo financeiro

**Branch:** `fix/fuso-competencia-financeiro`, a partir de `71b4ff2` (tip de `feat/console-financeiro`).
**Suíte:** 700 testes passando em 60 arquivos (base: 661/58). 1 arquivo falha, pré-existente — ver "Ruído pré-existente".
**`npx tsc --noEmit`:** limpo. **`eslint`:** 0 erros.

---

## 0. A worktree nasceu na base errada (confirmado)

A worktree foi criada em `999d4f9` — o **merge-base**, não o tip. `lib/db/payments.ts`,
`lib/reconciliacao.ts` e `lib/finance-config.ts` não existiam. Refiz a branch a partir de
`71b4ff2` antes de qualquer edição:

```
git merge-base 71b4ff2 HEAD  →  999d4f94...   (= onde a worktree estava)
git checkout -B fix/fuso-competencia-financeiro 71b4ff2
```

Nenhum arquivo foi reescrito do zero.

---

## 1. A regra única de competência

> **`payments.paid_at` guarda o INSTANTE ABSOLUTO em que o pagamento foi aprovado
> (coluna `timestamptz`); a competência desse pagamento é o mês desse instante
> convertido para `America/Sao_Paulo`, e essa conversão acontece exclusivamente em
> `lib/competencia.ts`.**

Está escrita no código, no topo de `lib/competencia.ts`, junto com os corolários que o
resto do módulo pode assumir. Os quatro pontos de entrada:

| função | o que faz |
|---|---|
| `instanteMs(texto)` | texto → epoch ms. **Exige offset explícito**; devolve `null` sem ele. |
| `competenciaDeInstante(texto)` | texto → `"YYYY-MM"` no calendário de São Paulo. |
| `competenciaAtual(agora?)` | mês corrente em São Paulo (default do picker). |
| `periodoDaCompetencia(c)` | `"YYYY-MM"` → `PeriodoSemiaberto` `[from, to)` em instantes ancorados na meia-noite de São Paulo. |

Agosto/2026 é `2026-08-01T03:00:00.000Z` → `2026-09-01T03:00:00.000Z`.

O offset de São Paulo é lido do `Intl` a cada instante, não fixado em `-03:00`: o Brasil já
teve horário de verão e pode voltar a ter, e um `-03:00` hardcoded erraria a virada do mês
por uma hora nos meses de transição.

**A decisão mais consequente é `instanteMs` recusar carimbo sem offset.** `"2026-08-31
22:00:00"` não designa instante nenhum — lê-lo como UTC ou como São Paulo dá dois momentos
a 3 h de distância. Recusar transforma um erro silencioso de competência em um dado
visivelmente ausente na tela, que alguém conserta. É a única resposta que não escolhe um
fuso em segredo.

---

## 2. CRITICAL A — `paid_at` virou `timestamptz`

- `lib/schema.ts`: `timestamp("paid_at", { mode: "string", withTimezone: true })`.
- `drizzle/0006_loud_zuras.sql`: `"paid_at" timestamp with time zone NOT NULL`.
- `drizzle/meta/0006_snapshot.json`: `"type": "timestamp with time zone"`.

**A janela estava mesmo aberta.** `git log main -- drizzle/0006_loud_zuras.sql` volta vazio
e `git ls-tree main drizzle/` para em `0005` — a migration nunca rodou em produção. Editei a
0006 no lugar em vez de criar uma 0007; `npx drizzle-kit generate` depois disso responde
**"No schema changes, nothing to migrate"**, ou seja, schema e snapshot estão coerentes e
nenhuma migration espúria nasce no próximo `generate`.

Agora as duas fontes de escrita gravam o mesmo tipo de coisa: o `date_approved` do MP
(`...-03:00`) tem o offset **honrado**, e o fallback `new Date().toISOString()` (`...Z`)
também. O instante deixa de ser irrecuperável.

### 2.1. Um segundo relógio que eu encontrei no caminho (não estava no relatório)

Trocar o tipo não bastava. Com `mode: "string"` + `withTimezone: true`, o `pg` entrega um
`Date` e **o drizzle remonta a string** em `PgTimestampString.mapFromDriverValue`:

```js
const shortened = value.toISOString().slice(0, -1).replace("T", " "); // relógio de UTC
const offset = value.getTimezoneOffset();                             // offset da MÁQUINA
```

Os dois pedaços vêm de fusos diferentes. Verifiquei rodando:

```
driver devolve : 2026-09-01T01:00:00.000Z
drizzle string : 2026-09-01 01:00:00.000-03     ← num host -03:00
instante da str: 2026-09-01T04:00:00.000Z       ← 3 h adiante do real
BATE? false
```

Num host UTC (a Vercel) o offset é `+00` e a string sai correta **por coincidência**. Em
qualquer outro host — a máquina de quem desenvolve — sai errada por 3 h, em silêncio, na
direção que quebra competência. Deixar isso de pé seria trocar a causa-raiz de lugar em vez
de matá-la.

Correção: `lib/db/date-parsers.ts` (novo) registra parser identidade para o OID 1184, e
`lib/db/client.ts` o chama ao lado do `setTypeParser(20, ...)` que já existia. O `pg` passa
a devolver o texto cru do Postgres (`2026-08-31 22:00:00-03`), o drizzle repassa sem tocar,
e o offset viaja dentro do dado. **Nenhuma outra coluna do schema é `timestamptz`**
(`grep withTimezone lib/schema.ts` só acha `paid_at`), então o alcance é exatamente uma
coluna.

> `lib/db/client.ts` não estava na minha lista de arquivos. Toquei nele porque é a camada de
> parsing de data e a mudança é de uma linha, mas está sinalizado aqui de propósito.

---

## 3. CRITICAL B — fila fiscal

`components/superadmin/FilaFiscal.tsx` empilhava dois fusos (`new Date(string ingênua)` →
local do navegador, depois `getUTCMonth()`). Agora chama `competenciaDeInstante` — o mesmo
classificador de `sumCaixa` e da base do DAS — e formata `YYYY-MM` → `MM/AAAA` por recorte
de string, sem `Date` no meio (estilo de `ImpostoCard.mesBR`).

Carimbo ilegível exibe **"Competência indisponível"** em vez de um mês chutado. É a linha
que o contador lê para decidir em que mês emitir a NFS-e; um chute aqui vira nota emitida.

---

## 4. IMPORTANT E — `paid_at` deixou de ser campo livre

Regra implementada em `app/api/webhooks/mercadopago/route.ts`: **`paid_at` só muda quando a
notificação (a) traz uma data do Mercado Pago e (b) tem autoridade sobre a linha** — o mesmo
`shouldOverwriteStatus` que libera o `status`.

```ts
const temAutoridade = shouldOverwriteStatus(existing.status, status);
...
if (temAutoridade && paidAtDoMp) { patch.paid_at = paidAtDoMp; }
```

`paidAtDoMp` e `paidAt` são variáveis separadas agora: só o INSERT aceita o fallback "agora"
(gravar com carimbo aproximado é melhor que perder a notificação); o UPDATE não aceita.

Fecha os dois buracos: a reentrega fora de ordem, que tinha o `status` recusado mas
reescrevia a data (recusava a decisão e aceitava a consequência dela), e a notificação sem
data, cujo `paidAt` é o relógio da máquina — um retry processado às 00:30 do dia 1º jogava
para a competência seguinte um pagamento do mês passado. O caso legítimo (`pending` com
`date_created` → `approved` com `date_approved`) continua funcionando.

---

## 5. MINOR — as duas convenções viraram uma

`mesBoundsInclusivos` foi **removida**. `sumGrossBetween` passou a ser semiaberto como
`listPaymentsByPeriod`, e os dois usam um predicado único:

```ts
function dentroDoPeriodo({ from, to }: PeriodoSemiaberto) {
  return and(gte(payments.paid_at, from), lt(payments.paid_at, to));
}
```

E o descasamento ficou **impossível de cometer**, não só improvável: `sumGrossBetween` agora
recebe um `PeriodoSemiaberto`, tipo com marca nominal (`unique symbol` declarado, sem
existência em runtime) que só `periodoDaCompetencia` produz. Verifiquei que a marca morde:

```
error TS2345: Argument of type '{ from: string; to: string; }' is not assignable
  to parameter of type 'PeriodoSemiaberto'.
  Property '[MARCA_SEMIABERTO]' is missing
```

Antes o tipo era `(fromISO: string, toISO: string)` — estrutural, e o `tsc` não distinguia um
fetcher inclusivo de um semiaberto.

---

## 6. Task 9: `lib/reconciliacao.ts` realinhada (decisão invertida)

`dentroDaCompetencia` **voltou a comparar instante**. `relogioDeParedeMs` e o regex
`RELOGIO_DE_PAREDE` foram removidos; a função usa `instanteMs`.

O argumento da Task 9 — *"o invariante não é 'é São Paulo', é 'não existe uma segunda opinião
sobre em que mês a linha está'"* — continua certo. O que caiu foi a premissa: com o banco
guardando instante, é o recorte por relógio de parede que passaria a ser a segunda opinião.
Os dois lados continuam concordando; agora concordam no certo.

O risco residual que o revisor apontou está eliminado: **se o MP mandar `Z`, nada desliza**.
Há teste afirmando que quatro grafias do mesmo instante (`-03:00`, `Z`, `+00` com espaço,
`+05:00`) caem todas em agosto.

### `MP_FOLGA_MS` — vira margem, não sobra

Respondendo à pergunta direta: **deixei os 24 h, com a justificativa reescrita.**

Ela *existia* por correção — o MP filtra por instante, a competência era relógio de parede,
e sem folga o pagamento das 22h do dia 31 não voltava nem para aparecer como faltante. Isso
acabou: `range=date_approved` no MP e `periodBounds` agora recortam a mesma coisa, então
pedir exatamente `[from, to)` seria correto.

Mas a folga não é sobra: a semântica de borda de `begin_date`/`end_date` do MP não é
documentada como inclusiva ou exclusiva, e os carimbos têm granularidade de segundo. O custo
de mantê-la é alguns resultados a mais, descartados localmente; o custo de errar para menos é
um pagamento invisível no fechamento do mês. Assimetria clara — mantida como margem, e o
comentário agora diz isso em vez de dizer "cobre qualquer offset".

### Testes reescritos, não afrouxados

Os 6 testes de `dentroDaCompetencia` afirmavam relógio de parede. **Reescrevi afirmando a
semântica nova**, e o bloco começa registrando por que a inversão foi deliberada — o
argumento antigo, o preço dele, e o que mudou. Dois testes novos entraram: o cruzamento com
`competenciaDeInstante` (os dois não podem discordar) e "carimbo sem offset é ilegível, não
'fora da competência'".

Também ficaram obsoletos e foram reescritos, em `tests/api/payments-reconciliar.test.ts`:

- **`const AGOSTO`** era `{ 00:00Z, 00:00Z }` copiado à mão. Copiar a janela transforma o
  teste numa segunda definição de competência — foi assim que ele passou a afirmar limites de
  UTC enquanto o produto recortava outro mês. Agora é `periodoDaCompetencia("2026-08")`, da
  implementação real, e não pode mais divergir.
- Três fixtures de borda estavam em `Z` (`"2026-09-01T00:00:00.000Z"` como "fora de agosto" —
  mas isso é 31/08 21:00 em São Paulo, ou seja, **dentro**). Passaram para `-03:00`,
  expressando a mesma intenção na regra real.
- A asserção da folga passou de `2026-07-31T00:00:00.000Z` para `...T03:00:00.000Z`.

### Um efeito colateral que eu tratei

Com `instanteMs` recusando carimbo sem offset, uma data ilegível cairia no `continue` de
"fora da competência" e o pagamento sumiria de todas as categorias — "Tudo conferido" com o
mês faturando a menos, que é o modo de falha exato que a rota existe para pegar. Adicionei
na rota, antes do recorte, um teste de legibilidade que manda o caso para `ignorados` com
motivo explícito.

> A rota `reconciliar` não estava na minha lista. Toquei em três pontos, todos de
> data/janela: `MP_FOLGA_MS` (que a task pediu para avaliar), o comentário de `buscarNoMp` e
> este `ignorados`. Sinalizado aqui.

---

## 7. As três mutações — cada uma morre por teste

Confirmei uma a uma removendo a proteção, vendo o teste falhar, e restaurando **editando o
arquivo de volta** (nenhum `git checkout`/`reset`/`stash`/`clean`).

| # | mutação | teste que mata | resultado |
|---|---|---|---|
| 1 | `sumGrossBetween`: `lt` → `lte` | `sumGrossBetween — mesma fronteira...` (SQL compilado) | 2 testes falharam |
| 2 | `dentroDoPeriodo`: `gte` → `gt` | `listPaymentsByPeriod — as duas fronteiras...` | 2 testes falharam |
| 3 | `competenciaAtual` → `toISOString().slice(0,7)` | `competenciaAtual — o mês corrente em São Paulo` | 2 testes falharam |

Extras confirmados do mesmo jeito:

| mutação | resultado |
|---|---|
| `FilaFiscal.competenciaDe` de volta a `new Date` + `getUTCMonth` | 4 testes falharam |
| `patch.paid_at = paidAt` incondicional (IMPORTANT E) | 2 testes falharam |

**A asserção é o predicado inteiro, não um `contains`:**

```ts
expect(sql).toBe('("payments"."paid_at" >= $1 and "payments"."paid_at" < $2)');
expect(params).toEqual([AGOSTO_FROM, AGOSTO_TO]);
```

Os parâmetros entram na asserção de propósito: o predicado certo sobre a janela errada erra a
competência do mesmo jeito. O antigo `expect(compiled).toContain("<")` sobrevivia a `<` e a
`<=`; e o `dentro()` local de `tests/lib/finance-config.test.ts:282` reimplementava o
predicado, então nunca tocava no SQL de verdade — sumiu junto com `mesBoundsInclusivos`,
substituído por um cruzamento entre a aritmética de limites e o classificador por fuso.

Todos os mocks novos usam `vi.hoisted`.

---

## 8. O que EXIGE banco de verdade para confirmar

Não há Postgres nem navegador nesta sessão. **Mudei um tipo de coluna sem poder rodar a
migration** — esta é a lista do que o dono precisa verificar antes de mergear.

### 8.1. A migration aplica e a coluna nasce `timestamptz` (bloqueante)

```bash
npm run db:migrate
```

```sql
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'payments' AND column_name = 'paid_at';
-- esperado: paid_at | timestamp with time zone
```

### 8.2. O offset é honrado na escrita (bloqueante — é a causa-raiz)

```sql
INSERT INTO payments (tenant_name, mp_payment_id, gross_cents, status, paid_at)
VALUES ('teste-fuso', 'tz-check-1', 100, 'approved', '2026-08-31T22:00:00.000-03:00');

SELECT paid_at AT TIME ZONE 'UTC'         AS instante_utc,
       paid_at AT TIME ZONE 'America/Sao_Paulo' AS relogio_sp
  FROM payments WHERE mp_payment_id = 'tz-check-1';
-- esperado: 2026-09-01 01:00:00  |  2026-08-31 22:00:00
-- (se instante_utc vier 2026-08-31 22:00:00, o offset foi descartado → coluna errada)

DELETE FROM payments WHERE mp_payment_id = 'tz-check-1';
```

### 8.3. O formato que chega na aplicação (bloqueante — é o §2.1)

O parser identidade do OID 1184 é a única peça cuja saída eu não pude observar contra um
Postgres real. Confirmar que a string tem offset explícito:

```bash
node -e '
const { db } = require("./lib/db/client");
db.select().from(require("./lib/schema").payments).limit(1)
  .then(r => console.log(JSON.stringify(r[0]?.paid_at)));
'
# esperado: algo como "2026-09-01 01:00:00+00" — COM offset no fim.
# Se vier "2026-09-01 01:00:00" (sem offset), `instanteMs` devolve null e a fila
# fiscal mostra "Competência indisponível": o parser não pegou.
```

### 8.4. A borda, ponta a ponta, no navegador

Nenhuma tela foi aberta (limitação conhecida desta branch — o PR #47 também subiu sem isso).
Com uma linha de teste em `2026-08-31T22:00:00-03:00` e o picker em `2026-08`:

- Caixa conta o pagamento em agosto;
- Fila fiscal mostra **"Competência 08/2026"** na mesma linha;
- Reconciliação de agosto o classifica como "já registrado", não como faltante;
- Reconciliação de **setembro** não o oferece como faltante fantasma.

Os quatro concordarem é o teste de aceitação da regra única. Vale abrir em
`<slug>.localhost:3000` — preview da Vercel dá 404 em página com tenant.

### 8.5. Fuso do processo em produção

O parser identidade torna a leitura independente do `TZ` do host, mas vale confirmar que a
Vercel segue em UTC (`node -e 'console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)'`),
porque é a premissa que o código **deixou** de depender — bom saber se ela muda.

---

## 9. Residuais que eu deliberadamente não toquei

- **`nfse_issued_at` e `created_at` continuam `timestamp` sem tz.** `registerNfse` grava
  `CURRENT_TIMESTAMP` neles. Não decidem competência (a competência sai de `paid_at`), e
  `registerNfse` é do outro agente — não mexi para não conflitar. Se um dia alguém agrupar
  nota emitida por mês, o mesmo bug reaparece ali.
- **`app/api/superadmin/payments/reconciliar/route.ts:~370`** tem o mesmo
  `patch.paid_at = paidAt` incondicional do webhook, no caminho de correção de divergente.
  Ali o operador confirmou o diff explicitamente (com token amarrado ao conjunto), então é
  uma decisão tomada, não uma sobrescrita cega — mas é a mesma forma e merece uma segunda
  opinião de quem for revisar.

## Ruído pré-existente

`tests/lib/ratelimit.test.ts` falha ao importar: `Cannot find package 'server-only'`. Falha
igual no commit base, antes de qualquer edição minha — é dependência faltando no
`node_modules` compartilhado (a worktree é aninhada e resolve o do projeto pai), não código.
Por isso a contagem é "700 passando, 1 arquivo falhando": os testes desse arquivo nunca
chegam a rodar.
