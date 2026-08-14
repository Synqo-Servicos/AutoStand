# Contas a pagar — registro de conclusão

**Concluída:** 2026-08-14
**Branch:** `feat/contas-a-pagar` (a partir de `origin/main` = `efd5a36`)
**Plano:** `docs/superpowers/plans/2026-08-13-contas-a-pagar-e-avisos.md`
**Spec:** `docs/superpowers/specs/2026-08-13-contas-a-pagar-e-avisos-design.md`

> As 11 tasks foram executadas por subagentes, cada uma com revisão individual e loop de correção, mais uma revisão final de branch inteira. Este documento é o que sobrevive: o ledger da execução vivia em `.superpowers/sdd/`, que é git-ignored.

---

## Estado: completa, revisada, **não mergeada**

**28 commits · 333 testes passando · `tsc` limpo · build de 52 rotas.**

Veredicto da revisão final (modelo mais capaz, branch inteira): **pronto com ressalvas**. Nada corrompe dinheiro nem vaza dado entre lojas. As cinco ressalvas bloqueantes foram corrigidas em `c916295`.

| # | Task | Commit final |
|---|---|---|
| 1 | Módulo puro de recorrência (`lib/recurring.ts`) | `f2ea562` |
| 2 | Schema + migration `0005` | `0d7c526` |
| 3 | Camada de dados (`lib/db/payables.ts`) | `d6e848f` |
| 4 | Validação + rotas CRUD | `3dc2506` |
| 5 | Rota de pagamento | `d91d8ca` |
| 6 | Anexos (presign + rotas) | `5e44fa8` |
| 7 | Template + notify de e-mail | `17801dd` |
| 8 | Cron de avisos | `98c0349` |
| 9 | Aba "Contas a pagar" | `f9999e6` |
| 10 | Formulários + modal de pagamento | `4d9d15b` |
| 11 | Banner + badge | `23a6f70` |
| — | Onda final de correção | `c916295` |

## Já aplicado em produção

- **Migration `0005`** aplicada no Neon em 14/08 (run `31836347353`). Aditiva: 3 `CREATE TABLE`, 3 `ADD COLUMN`, 1 índice, zero `DROP`.
- **`CRON_SECRET`** cadastrada na Vercel (Production, Sensitive).
- **Ambiente `homologation` removido** — seu `DATABASE_URL` apontava para o RDS deletado em 20/07 e qualquer run morria em `ENOTFOUND`. A opção saiu dos dois workflows (`c655ffa`).

> **Consequência: não existe mais banco de staging.** O único banco vivo é o Production (Neon). Para ensaiar uma migration, criar um branch no Neon e apontar um ambiente novo para ele.

## ⚠️ A limitação que nenhuma correção de código resolve

**Nenhuma linha desta branch foi aberta num navegador.** O `DATABASE_URL` do `.env.local` é `file:local.db` — resíduo da migração Turso→libSQL para Neon/Postgres — então o app não sobe localmente contra banco. Não há teste de componente no projeto.

Toda a UI foi verificada apenas por leitura de código, `tsc` e `npm run build`. Ficam sem confirmação: modal sobre modal (`PayableRulesPanel` → `PayableForm` → `useConfirm`), `router.refresh()` após salvar, o `datalist` de categorias dentro de portal Radix, o `<input type="date">`, o banner e o badge, e o layout em telas estreitas.

**É o maior risco residual do merge.** Destravar exige um `DATABASE_URL` Postgres utilizável — branch do Neon ou Postgres local — e abrir `<slug>.localhost:3000/admin/financeiro?tab=contas`. `*.vercel.app` não serve: página com tenant resolve por header `Host` e dá 404.

## Defeitos do plano descobertos na execução

O plano foi corrigido durante a execução. Quem o ler depois deve saber que as versões corrigidas é que valem:

1. **`TransactionInput` não fica em `lib/db/transactions.ts`** — vive em `types/transaction.ts` como `Omit<Transaction, "id"|"created_at">`; os campos novos são opcionais de propósito. *(`8f3348f`)*
2. **Zod 4 não tem `.innerType()` e `.partial()` lança** em schema com refinement. O plano extrai `payableBaseSchema` sem refinement e deriva create/update dele. *(`f4e0feb`)*
3. **O mock de teste de rota do plano era quebrado** — um `withTenant` falso sem `try/catch` nunca converte `ApiError` em resposta HTTP, então os casos 400/404/409 passariam por motivo errado. O padrão correto, já usado em `tests/api/uploads-presign.test.ts`, é mockar `@/lib/auth` e usar o `withTenant` **real**. *(`2620597`)*
4. **`s3Delete` recebe key, não URL** — o helper certo é `deleteFromBlob(url)`. *(`8f3348f`)*
5. **Modal de pagamento usava `toISOString().slice(0,10)`** — UTC; às 21h em Maceió mostraria amanhã. *(`8f3348f`)*
6. **A rota de anexos aceitava `url` do body** — falha **cross-tenant**: gravaria o objeto S3 de outra loja como anexo desta, e o `DELETE` apagaria o arquivo alheio. Corrigido para `key` + `assertKeyInFolder` + `publicUrlForKey`. *(`c72b3f8`)*
7. **`centsToDisplay` destruía centavos no round-trip** — `137,42` virava `137` e gravava R$ 137,00. Contas a pagar é o primeiro domínio do app onde centavos são a norma. Resolvido com `centsToDisplayFull`, sem alterar `centsToDisplay`/`formatBRL`, que servem veículos e dashboard. *(`4d9d15b`)*
8. **Os empty states escondiam os botões de criar conta** — no primeiro uso o lojista não teria como cadastrar a primeira. *(`77ba6fd`)*

## Pendências conhecidas (triadas como "pode esperar")

Nenhuma bloqueia o merge. Ordenadas por valor.

**Decisão de produto, não bug**
- **UI de anexos não existe.** `listPayableAttachments` tem zero call sites, nenhum formulário faz upload, não há rota `GET`. Backend pronto, testado e seguro, mas ocioso — decisão consciente (opção B). Quando essa frente for retomada, dois pré-requisitos: o `DELETE` ignora `params.id` (`/payables/999/anexos?anexo=10` apaga o anexo 10 do mesmo tenant), e `uploaded_by` está fixo em `null`.

**Bugs reais, fora do escopo desta branch**
- **`RegistrarVendaModal.tsx:35` e `OperationalExpenseList.tsx:138`** usam `toISOString().slice(0,10)`. Depois das 21h em Maceió a data padrão pula para amanhã; no dia 31 às 21h a despesa cai no mês seguinte do financeiro. Já em produção, em outras frentes. ~4 linhas.

**Robustez**
- **`countOverdue` roda no layout de `/admin`**, portanto em toda navegação do painel, sem `try/catch`. Se falhar, cai o painel inteiro, não só a aba. Em `/admin/dashboard` o `listBills` roda 2× por request (layout + página); `cache()` do React seria a saída, mas não é padrão no repo hoje.
- **Rota de pagamento aceita qualquer `due_date`** que case o regex, sem perguntar a `expandOccurrences` se aquela data é ocorrência da regra. Não alcançável pela UI.
- **Race de pagamento duplicado** — check-then-insert fora de transação, sem índice único em `(tenant_id, payable_id, due_date)`. Mitigado pelo botão que desabilita em `loading`, mesma postura já usada na venda.
- **Sem `timingSafeEqual` no `CRON_SECRET`** — o repo usa em 3 outros lugares. Consistência, não risco.

**UX**
- `MonthPicker` renderiza inerte na aba "contas"; validação de parcelas dispara com frequência "única" e campo desabilitado; sem `toast.success` nos três fluxos; painel de regras reabre com dado velho antes do `router.refresh()`; linha do `PayableRulesPanel` sem `flex-wrap` esmaga em ~360px; desativar conta é irreversível pela UI (`includeInactive` existe e não tem call site).

**Investigado e descartado**
- **Subject de e-mail com `tenant.name` sem `esc()`** — **não é vulnerabilidade**. O nodemailer colapsa CR/LF antes de montar o header, e `esc()` num Subject seria errado (viraria `&amp;` literal na caixa de entrada).

## Só um humano resolve

1. **Abrir a UI num navegador** — ver a seção de limitação acima. Maior risco residual.
2. **Decidir se o commit de preços vai junto.** `f390893` muda Pro 349,90→249,90 e Premium 499,90→349,90. Merge = produção no mesmo instante. Se não for para publicar agora, tirar para uma branch própria.
3. **Confirmar o cron no dashboard da Vercel** após o primeiro deploy — é o primeiro `vercel.json` do projeto — e olhar a execução das 8h BRT. Não há alerta se ela 401ar, 500ar ou estourar timeout; o único sinal é `{ok, tenants, sent}` no log.
4. **Confirmar `GMAIL_APP_PASSWORD` em Production.** Se faltar, `notifyUpcomingBills` é no-op gracioso **com o claim já gravado** — aquele estágio daquele vencimento nunca sai, nem retroativamente.
5. **Registrar `CRON_SECRET` em lugar durável.** Não há `.env.example` nem doc de env no repo; a próxima pessoa não tem como saber que ela existe.
