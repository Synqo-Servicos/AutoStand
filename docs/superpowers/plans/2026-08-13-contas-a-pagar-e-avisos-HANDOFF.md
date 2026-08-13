# Contas a pagar — onde paramos

**Data da pausa:** 2026-08-13
**Branch:** `feat/contas-a-pagar` (a partir de `origin/main` = `efd5a36`)
**Plano:** `docs/superpowers/plans/2026-08-13-contas-a-pagar-e-avisos.md`
**Spec:** `docs/superpowers/specs/2026-08-13-contas-a-pagar-e-avisos-design.md`

> Este documento existe porque o ledger da execução (`.superpowers/sdd/2026-08-13-contas-a-pagar-e-avisos/progress.md`) é git-ignored e um `git clean -fdx` o destrói. Aqui está o que precisa sobreviver.

---

## Estado: 5 de 11 tasks concluídas

Suíte em **289 testes passando**, `npx tsc --noEmit` limpo. Nada em produção.

| # | Task | Estado | Commit final |
|---|---|---|---|
| 1 | Módulo puro de recorrência (`lib/recurring.ts`) | ✅ revisada, limpa | `f2ea562` |
| 2 | Schema + migration | ✅ revisada, limpa | `0d7c526` |
| 3 | Camada de dados (`lib/db/payables.ts`) | ✅ revisada (1 fix round) | `d6e848f` |
| 4 | Validação + rotas CRUD | ✅ revisada, limpa | `3dc2506` |
| 5 | Rota de pagamento | ✅ revisada, limpa | `d91d8ca` |
| 6 | Anexos (presign + rotas) | ⏸️ **não iniciada** | — |
| 7 | Template + notify de e-mail | ⏸️ não iniciada | — |
| 8 | Cron de avisos | ⏸️ não iniciada | — |
| 9 | Aba "Contas a pagar" | ⏸️ não iniciada | — |
| 10 | Formulários + modal de pagamento | ⏸️ não iniciada | — |
| 11 | Banner + badge | ⏸️ não iniciada | — |

**Correção (mesma data, ao retomar):** a Task 6 **tinha** trabalho parcial no working tree — a linha acima, escrita na pausa, estava errada. O agente interrompido alcançou escrever o kind do presign, o `case` da pasta, as funções de dados, o teste do presign (28 passando) e a rota de anexos, tudo verde no `tsc`. Faltava commit, testes da rota e relatório. Ver a seção "Defeito #6" abaixo — esse trabalho parcial corrigiu uma falha de segurança do plano.

## O que já funciona

Backend das contas a pagar completo até o registro de pagamento:

- `lib/recurring.ts` — expansão de recorrência (única/mensal/anual), clamp de fim de mês, classificação de status, estágio de aviso. Puro, 40 testes.
- Tabelas `payables`, `payable_attachments`, `sent_notifications`; colunas `payable_id`, `due_date`, `payment_method` em `transactions`. Migration `drizzle/0005_quiet_talkback.sql`.
- `lib/db/payables.ts` — CRUD com allowlist, `listBills` (derivação), `hasPaymentFor` (trava de duplicata), `countOverdue`.
- `GET/POST /api/payables`, `PATCH /api/payables/[id]`, `POST /api/payables/[id]/pagar`.

**Nada disso está ligado a nenhuma tela.** As tasks 9–11 são a UI inteira; hoje a feature é invisível para o lojista.

## Como retomar

O fluxo é a skill `superpowers:subagent-driven-development`. Retomar significa:

1. Ler o ledger em `.superpowers/sdd/2026-08-13-contas-a-pagar-e-avisos/progress.md` (se ainda existir) — ele tem os minors adiados e as decisões.
2. Gerar o brief da Task 6 e seguir o loop: implementador → revisão → fix rounds → ledger.
3. `BASE` da Task 6 é `d91d8ca`.

As tasks 6, 7 e 8 são independentes entre si. As tasks 9–11 dependem de 6 e 7 apenas para os anexos e o e-mail; a aba em si só depende do que já existe.

## Defeitos do plano encontrados na execução

Corrigidos no próprio plano — mas quem retomar precisa saber que **o plano foi editado depois de escrito**, e as versões corrigidas é que valem:

1. **`TransactionInput` não fica em `lib/db/transactions.ts`** — vive em `types/transaction.ts` como `Omit<Transaction, "id"|"created_at">`. Os campos novos são opcionais de propósito; obrigatórios quebrariam todos os callers existentes. *(commit `8f3348f`)*

2. **Zod 4 não tem `.innerType()` e `.partial()` lança** em schema com refinement (`"cannot be used on object schemas containing refinements"`). O plano agora extrai `payableBaseSchema` sem refinement e deriva create e update dele. Verificado empiricamente. *(commit `f4e0feb`)*

3. **O mock de teste de rota do plano era quebrado** — um `withTenant` falso sem `try/catch` nunca converte `ApiError` em resposta HTTP, então os casos 400/404/409 rejeitariam a promise em vez de resolver uma `Response`. O padrão correto, já usado em `tests/api/uploads-presign.test.ts`, é mockar `@/lib/auth` (`getApiTenantId`) e usar o `withTenant` **real**. *(commit `2620597`)*

4. **`s3Delete` recebe key, não URL** — o helper certo para apagar anexo é `deleteFromBlob(url)` de `@/lib/blob`. Chamar `s3Delete` com a URL apagaria nada, silenciosamente. Já corrigido no texto da Task 6. *(commit `8f3348f`)*

5. **Modal de pagamento usava `toISOString().slice(0,10)`** para a data padrão — isso é UTC, e às 21h em Maceió mostraria amanhã. Trocado por `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`. *(commit `8f3348f`)*

6. **A rota de anexos do plano aceitava `url` do body** (`url: z.string().url()`) — falha **cross-tenant**. Um body com URL arbitrária gravaria o objeto S3 de outra loja como anexo desta conta, e o `DELETE`, que confia no que está no banco, apagaria esse arquivo alheio via `deleteFromBlob(row.url)`. O correto é aceitar `key`, validar com `assertKeyInFolder(key, uploadFolder("payable", tenantId))` e derivar a URL no servidor com `publicUrlForKey` — padrão que `app/api/vehicles/[id]/photos/route.ts` já usava. Encontrado pelo implementador da Task 6, não pelo plano nem pela revisão.

## Achados menores adiados (para a revisão final triar)

- **Task 2:** nenhum teste cobre a *ação* da FK `transactions.payable_id` — trocar `SET NULL` por `CASCADE` não quebraria teste nenhum, e apagaria histórico financeiro.
- **Task 4:** dois dos quatro casos de erro do `POST` não assertam que `createPayable` não foi chamada.
- **Task 4:** `z.enum(["despesa_fixa","despesa_var"])` inline em `lib/validation.ts`, sem constante compartilhada com o comentário do enum em `lib/schema.ts`.
- **Task 5:** o comentário do cast `payable.type as TransactionType` explica o erro do TS mas não por que o cast é seguro.
- **Task 5:** o teste "404 quando a conta é de outro tenant" só exercita `getPayable → null`; o nome promete mais do que verifica.
- **Tasks 1–3:** contagens de linha/teste imprecisas em alguns relatórios de subagente (não afetam código).

## Antes de qualquer merge

- [ ] Aplicar `drizzle/0005_quiet_talkback.sql` no **Neon** via `migrate.yml` — **antes** de mergear. Merge na `main` publica produção sozinho, e a UI subiria contra um banco sem as colunas.
- [ ] Cadastrar `CRON_SECRET` na Vercel (Production **e** Preview) — sem ela a rota do cron devolve 401 até para o próprio cron. *(só importa a partir da Task 8)*
- [ ] Confirmar o plano da Vercel: no Hobby, cron é 1×/dia com precisão de hora (pode sair 8h40 em vez de 8h).
- [ ] Verificar a UI em `<slug>.localhost:3000` — preview `*.vercel.app` dá 404 em página com tenant (resolução por `Host`).

## Nota sobre esta branch

Ela carrega **um commit não relacionado**: `f390893`, o ajuste de preços dos planos (Pro R$ 249,90, Premium R$ 349,90). Ele entrou antes de a branch de feature ser criada. Se quiser publicar o preço novo sem esperar as contas a pagar ficarem prontas, esse commit precisa sair daqui para uma branch própria.
