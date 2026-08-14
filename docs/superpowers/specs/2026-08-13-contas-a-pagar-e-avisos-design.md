# Contas a pagar e avisos de vencimento

**Data:** 2026-08-13
**Origem:** pedido recorrente de clientes em conversa comercial — gestão financeira, avisos de vencimento de contas e gastos recorrentes (aluguel, energia, impostos).
**Escopo:** painel `/admin` — módulo financeiro. Uma frente, implementável em fatias verticais.

---

## Contexto

O financeiro do painel hoje é um **livro-caixa do passado**. `transactions` (`lib/schema.ts:217`) já tem os tipos `despesa_fixa` (aluguel, salário) e `despesa_var` (marketing, manutenção), e `EXPENSE_CATEGORIES` (`lib/constants.ts:107`) já lista exatamente as categorias que os clientes citaram — Aluguel, Energia, Água, Internet, IPTU, Condomínio, DAS, INSS, ISS.

O que não existe:

- **vencimento** — `transactions.date` é a data em que a despesa aconteceu, não a data em que ela vence;
- **estado "não pago"** — toda linha do ledger é um fato consumado;
- **recorrência** — "todo dia 10" não tem onde morar;
- **qualquer disparo agendado** — não há `vercel.json` nem `vercel.ts` no projeto. Nenhum cron roda hoje.

O lojista, portanto, só descobre que o aluguel venceu quando alguém cobra. O sistema tem os dados para avisar e não avisa.

### Decisões de produto tomadas antes do design

| Decisão | Escolha | Razão |
|---|---|---|
| Escopo | Contas a pagar leve — não só lembrete | Aviso que não vira ação é ruído. O botão "paguei" tem de fechar o ciclo no próprio financeiro. |
| Canal | In-app + e-mail diário | Quem esquece de pagar o aluguel também esquece de abrir o painel. In-app sozinho só serve quem já está olhando. |
| Gating por plano | **Todos os planos** | Foi pedido como dor. Gatear dor pedida gera ressentimento — e o financeiro é o gancho de retenção: só funciona se todos puserem dado real ali. Além disso, todo o gating atual é sobre o site (cores, layout, domínio, Instagram) e inteligência (IA, demanda); gestão é eixo ortogonal e embaralharia a narrativa da escada de planos. |
| Projeção de caixa | **Fora da v1** | Contas a pagar + a receber + saldo projetado é milestone próprio. Constrói-se em cima deste modelo depois. |

---

## Arquitetura: regra + derivação

A conta é uma **regra** ("aluguel, R$4.500, todo dia 10"). O pagamento é um **fato** (uma transação). A ocorrência — "o aluguel de agosto" — **não é persistida**: é derivada.

Esse é o mesmo idioma de `listPendingSales` (`lib/db/vehicles.ts:55`), que já resolve "veículo vendido sem transação de saída" por `NOT EXISTS`, com o comentário no código: *"Lista derivada de propósito — sai sozinha quando a transação é criada"*.

**Por que não materializar as ocorrências:** duas fontes de verdade, lógica de geração, backfill, e a pergunta insolúvel de "a regra mudou, regero as futuras?". Ganharia "dispensar este mês" e ajuste por ocorrência — que não são a dor descrita.

**Por que não pôr estado em `transactions`:** adicionar `status: previsto | pago` ao ledger envenenaria `getFinanceiroResumo` e `getOperationalExpenses`, que passariam a somar dinheiro que não saiu, a menos que toda query existente ganhe um filtro. Mina espalhada por um financeiro que já funciona.

---

## Modelo de dados

### Tabela nova: `payables`

A regra. Nomeada `payables` — não `recurring_expenses` — porque `frequency` inclui `unica`, e uma conta avulsa com vencimento (parcela do financiamento, conserto a pagar dia 20) é o mesmo objeto com uma ocorrência só.

| coluna | tipo | nota |
|---|---|---|
| `id` | serial PK | |
| `tenant_id` | integer NOT NULL | → `tenants`, `ON DELETE CASCADE` |
| `type` | text NOT NULL | `despesa_fixa` \| `despesa_var` — espelha `transactions.type` |
| `category` | text | valor de `EXPENSE_CATEGORIES` ou texto livre |
| `description` | text | rótulo do lojista ("Aluguel do galpão") |
| `supplier` | text | beneficiário ("Imobiliária Costa", "Equatorial") |
| `amount_cents` | integer | valor **previsto**, não o cobrado |
| `frequency` | text NOT NULL | `unica` \| `mensal` \| `anual` |
| `first_due_date` | text NOT NULL | `YYYY-MM-DD` — âncora da recorrência |
| `installments` | integer | total de parcelas; `null` = indefinido |
| `payment_method` | text | `boleto` \| `pix` \| `debito_automatico` \| `cartao` \| `transferencia` \| `dinheiro` |
| `active` | boolean NOT NULL | default `true` |
| `notes` | text | |
| `created_at` | timestamp | default now |

Índice: `(tenant_id, active)`.

**`first_due_date` como âncora única.** Substitui o trio `due_day` + `due_month` + `start_date`. `unica` → apenas aquela data. `mensal` → mesmo dia todo mês. `anual` → mesmo dia e mês todo ano. Além de economizar duas colunas, elimina um estado inconsistente que o trio permitia: `due_day = 10` com início em 20/08 — a ocorrência de agosto existe ou já venceu? Com `first_due_date = 2026-09-10` a pergunta não se formula.

**`installments` no lugar de `end_date`.** Os dois expressam a mesma coisa por caminhos diferentes — 12 parcelas *é* uma data-fim — e guardar ambos convida a divergirem. Contrato sem prazo definido usa `null`; quem para no meio usa `active = false`.

**Clamp de fim de mês.** `first_due_date = 2026-01-31` gera 28/02 (ou 29 em bissexto), 31/03, 30/04. Nunca transborda para o mês seguinte.

### Tabela nova: `payable_attachments`

Espelha `vehicle_documents` (`lib/schema.ts:190`), que já resolve anexo com presign S3.

| coluna | tipo | nota |
|---|---|---|
| `id` | serial PK | |
| `tenant_id` | integer NOT NULL | → `tenants`, cascade |
| `payable_id` | integer NOT NULL | → `payables`, cascade |
| `transaction_id` | integer | → `transactions`, cascade. `null` = boleto da conta; preenchido = comprovante do pagamento |
| `name` | text NOT NULL | nome de exibição |
| `url` | text NOT NULL | S3 via CloudFront |
| `size` | integer | |
| `mime_type` | text | |
| `uploaded_by` | integer | → `users`, `SET NULL` |
| `created_at` | timestamp | |

Índice: `(tenant_id, payable_id)`.

Um `kind` novo em `UPLOAD_RULES` (`lib/blob-constants.ts:51`): `payable`, com `DOC_MIMES`, `DOC_MAX_BYTES` e `needsVehicle: false`. Mais um `case` em `uploadFolder` (`lib/presign.ts:52`) → `tenants/{tenantId}/payables/{payableId}`.

> A convenção de pasta é load-bearing: `keyFromCdnUrl` e `s3Delete` fazem o caminho de volta a partir dela. Pasta nova, não alteração das existentes.

### Colunas novas em `transactions`

```
payable_id      integer → payables (ON DELETE SET NULL)
due_date        text     -- 'YYYY-MM-DD': qual vencimento esta transação quita
payment_method  text     -- herda da payable, editável no momento do pagamento
```

Índice: `(tenant_id, payable_id, due_date)` — sustenta a derivação e a trava de duplicata.

**`SET NULL`, não cascade.** O fluxo normal nunca apaga uma `payable` (só desativa), então é rede de segurança: se uma linha for removida por intervenção direta no banco, o histórico de aluguel pago continua no livro-caixa — a transação segue sendo uma despesa real e perde apenas o vínculo. Com cascade, uma limpeza manual apagaria receita de verdade.

`payment_method` é útil para o financeiro inteiro, não só para esta feature — por isso vai em `transactions`, não só em `payables`.

### `payables` não é deletável

Só desativável (`active = false`). Consistente com a postura que já existe para `saida` (nenhuma tela do painel apaga transação de saída), e resolve de graça a pergunta de cascade nos anexos: o comprovante de um pagamento real nunca some porque alguém apagou uma regra.

---

## Derivação das ocorrências

`lib/recurring.ts` — **módulo puro, sem banco**:

```
expandOccurrences(payable, { from, to }) -> Occurrence[]
classify(occurrence, transactions, today) -> 'pago' | 'a_vencer' | 'vence_hoje' | 'atrasado'
```

`lib/db/payables.ts` — acesso a dados:

```
listBills(tenantId, { from, to }) -> Bill[]
```

Duas queries, o resto em memória (N é uma dezena de regras por tenant):

1. Regras ativas do tenant cuja janela de vigência intersecta `[from, to]`
2. Transações da janela com `payable_id` não nulo
3. Expande cada regra nos vencimentos dentro de `[from, to]`, respeitando `installments`
4. Casa por `(payable_id, due_date)` e classifica

**Janela padrão:** início do mês atual **−2 meses** até o fim do mês seguinte, sempre limitada por `first_due_date`. Sem esse piso, uma regra cadastrada com vencimento antigo cospe dezenas de "atrasados" fantasma no primeiro acesso.

**A data de referência é injetada**, nunca `new Date()` interno — caso contrário o teste de 29 de fevereiro quebra sozinho fora de ano bissexto.

**Rótulo de parcela:** derivado do índice da ocorrência contra `installments` ("parcela 3 de 12"). Nada persistido.

---

## Registrar pagamento

Cria uma transação normal:

| campo | origem |
|---|---|
| `type`, `category` | da `payable` |
| `date` | data do pagamento (default hoje) |
| `amount` | **digitado pelo lojista**, pré-preenchido com o previsto |
| `payable_id`, `due_date` | da ocorrência |
| `payment_method` | da `payable`, editável |

O valor ser editável resolve energia — previsto R$800, veio R$943 — sem modelagem extra. `date` guarda o pagamento e `due_date` o vencimento: se pagou dia 12 o que vencia dia 10, os dois fatos sobrevivem.

**Nenhuma query existente do financeiro muda.** As transações geradas aqui são `despesa_fixa`/`despesa_var` como qualquer outra; `getFinanceiroResumo` e `getOperationalExpenses` já as contam sem saber que vieram de uma regra.

**Trava de duplicata:** a rota rejeita se já existe transação para o par `(payable_id, due_date)`. Mesma postura da trava de venda duplicada.

---

## Avisos por e-mail

### Cron

`vercel.json` — arquivo novo, o projeto não tem nenhum hoje:

```json
{ "crons": [{ "path": "/api/cron/avisos-vencimento", "schedule": "0 11 * * *" }] }
```

**11:00 UTC = 08:00 BRT.** Cron da Vercel roda em UTC; agendar `0 8 * * *` entregaria às 5 da manhã.

A rota valida `Authorization: Bearer ${CRON_SECRET}` e devolve 401 sem ele — sem isso, qualquer um dispara e-mail em massa para o cliente. Uma query varre todos os tenants (não N+1), agrupa por tenant, e ignora tenant com `status = 'suspended'`.

> **A confirmar:** no plano Hobby da Vercel, cron é 1×/dia com precisão de hora — pode sair 8h40. Não quebra nada, mas convém saber antes do cliente perguntar.

### Cadência — a parte que decide se a feature vive

Digest diário ingênuo manda "Aluguel vence em 5 dias" cinco dias seguidos. O lojista silencia, e a feature morre.

Cada conta entra no e-mail em no máximo **três momentos**: `D-3`, `D-0`, e depois **a cada 7 dias** enquanto atrasada. **Se nada se qualifica no dia, nenhum e-mail sai.**

**Débito automático é exceção:** recebe apenas o `D-3` ("vai sair R$4.500 da conta dia 10 — tenha saldo") e **nunca entra em atrasadas** nem no banner. O sistema não sabe se o débito ocorreu; tratar como inadimplência geraria alarme falso todo mês. A confirmação vem quando o lojista concilia.

### Idempotência

Tabela `sent_notifications`:

```
tenant_id  integer NOT NULL → tenants (cascade)
kind       text NOT NULL             -- 'vencimento'
ref_key    text NOT NULL             -- "{payable_id}:{due_date}:{estagio}"
                                     -- estagio ∈ 'd3' | 'd0' | 'atraso-7' | 'atraso-14' | 'atraso-21' | …
sent_at    timestamp NOT NULL
UNIQUE (tenant_id, kind, ref_key)
```

**Reivindicar antes de enviar**, mesmo padrão do `claimTenantForCheckout` que já existe para o Mercado Pago:

1. `INSERT … ON CONFLICT DO NOTHING` nos pares (conta, estágio) do dia
2. Envia o digest **apenas com os que realmente inseriram**
3. Se o envio falhar, apaga os claims → o cron do dia seguinte retenta

Vercel Cron é *at-least-once*. Enviar-e-depois-registrar duplicaria e-mail numa segunda execução; registrar-e-nunca-enviar produziria silêncio permanente. Reivindicar primeiro é a única ordem que erra para o lado recuperável.

### Template

`upcomingBills` em `lib/email/templates.ts` e `notifyUpcomingBills` em `lib/email/notify.ts` — mesma forma dos existentes (`leadNotification`, `paymentPastDue`). Destinatários: os `tenant_admin` do tenant. Vendedor não é usuário; não há outro papel por tenant.

---

## UI

**Nova aba "Contas a pagar"** em `/financeiro`, ao lado de Resumo / Por veículo / Despesas operacionais. Ocorrências da janela agrupadas por estado: **Atrasadas → Vencem esta semana → Próximas → Pagas do mês**. Cada linha exibe categoria, fornecedor, rótulo de parcela quando houver, valor previsto e forma de pagamento, com botão **Registrar pagamento**.

**Gestão das regras** atrás de um botão na própria aba — criar, editar, desativar. Não merece página própria.

**Banner no dashboard**, mesmo padrão do banner de pendências de venda: aparece só se há conta atrasada ou vencendo hoje/amanhã. **Badge** com a contagem de atrasadas no item Financeiro da sidebar.

**Modal de pagamento** na forma do `RegistrarVendaModal`: valor pré-preenchido e editável, data (default hoje), forma de pagamento, observação, anexo do comprovante. Salva → cria a transação → a ocorrência sai de pendente sozinha.

**Formulário da conta:** descrição, fornecedor, categoria (select das fixas + campo livre), tipo, valor previsto, frequência, primeiro vencimento, nº de parcelas, forma de pagamento, anexo do boleto, observação.

---

## Bordas e tratamento de erro

| Situação | Comportamento |
|---|---|
| `first_due_date` dia 29/30/31 em mês curto | Clamp no último dia do mês |
| Regra desativada no meio do mês | Para de gerar dali em diante; ocorrências já pagas permanecem no ledger |
| Pagamento duplicado | Rota rejeita o par `(payable_id, due_date)` repetido; UI esconde o botão |
| Tenant suspenso | Ignorado pelo cron |
| Falha de envio de e-mail | Claims apagados; retenta no dia seguinte. Sem retry no mesmo request |
| Regra criada com vencimento antigo | Janela de −2 meses limita o estrago; histórico retroativo continua sendo trabalho da aba de despesas operacionais |
| Anexo órfão | Não ocorre: `payables` não é deletável |

---

## Testes

**Puros — `lib/recurring.ts`, sem banco:**
- expansão `unica`, `mensal`, `anual`
- clamp de 31 em fevereiro; ano bissexto
- `installments` cortando a série; rótulo "parcela N de M"
- `first_due_date` fora da janela
- classificação de status contra data de referência injetada
- débito automático não classifica como `atrasado`

**Com banco — `lib/db/payables.ts`:**
- derivação com e sem transação casada
- isolamento entre tenants
- regra inativa não gera ocorrência

**Rota do cron:**
- 401 sem `CRON_SECRET`
- segunda chamada no mesmo dia não reenvia
- tenant suspenso ignorado
- falha de envio devolve o claim
- dia sem nada qualificado não dispara e-mail

**Rota de pagamento:**
- campos corretos na transação criada
- rejeita duplicata do par `(payable_id, due_date)`
- valida valor > 0

---

## Migration

`npm run db:generate` gera o SQL em `drizzle/`. Roda no Neon via `migrate.yml` **antes** de mergear na `main` — merge publica produção sozinho, e a UI subiria contra um banco sem as colunas novas.

---

## Fora de escopo (v2)

- Projeção de fluxo de caixa e contas a receber
- "Dispensar este mês" numa ocorrência específica — exigiria materializar ocorrências
- Categorias por tenant em tabela própria (v1 usa as fixas + campo livre)
- WhatsApp e push (PWA) como canais de aviso
- Conciliação bancária / importação de OFX
