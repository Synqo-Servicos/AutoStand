# Venda a partir do status, preço da assinatura e equilíbrio do painel

**Data:** 2026-07-28
**Origem:** pedido do gestor da loja (visão lojista)
**Escopo:** painel `/admin` — três frentes independentes que podem ser implementadas e revisadas em sequência.

---

## Contexto

Hoje o fluxo de venda é o inverso do mental model do lojista:

- `createTransaction` (`lib/db/transactions.ts:132`) marca o veículo como `vendido` quando alguém lança uma transação do tipo `saida`.
- Mudar o status para **Vendido** direto no formulário do veículo (`components/admin/VehicleForm.tsx:304`) **não cria transação nenhuma** — a venda não entra em Transações, não entra no Financeiro, não conta em `getFinanceiroResumo`, e a margem real do veículo nunca é apurada.

O lojista pensa "vendi o carro" e vai no cadastro do carro. O sistema espera que ele pense "preciso lançar uma saída no financeiro". Essa diferença gera buraco silencioso no faturamento.

Duas frentes menores acompanham:

- O preço do plano aparece no painel (`app/admin/(protected)/assinatura/page.tsx:40`) usando a tabela de preços, que **não reflete cupom aplicado** — pode divergir do valor realmente cobrado.
- Nenhuma página do admin usa `mx-auto`: todas são `max-w-*` alinhadas à esquerda, com sidebar fixa de 240px. Num monitor de 1920px sobram ~530px de branco só do lado direito. Em telas de MacBook o efeito quase não aparece, o que mascarou o problema.

---

## Frente 1 — Registrar a venda a partir do status

### Comportamento

1. O gestor edita o veículo, muda o status para **Vendido** e salva.
2. O veículo é persistido primeiro. Com o `PUT` bem-sucedido, abre o modal **"Registrar venda"**, com o veículo travado e o valor pré-preenchido com o preço de venda anunciado.
3. Confirmando, é criada a transação `saida` — que já dispara a comissão automática do vendedor e reafirma o status `vendido` (lógica existente, sem alteração).
4. Fechando sem registrar, nada trava: o veículo fica vendido e entra na faixa **"Vendas a registrar"** no topo de *Transações*, com botão que reabre o mesmo modal.

O modal abre **em toda virada genuína para `vendido`** — ou seja, quando o status era outro no último salvamento e passou a ser `vendido` agora. Quem lança pelo botão "Nova transação" continua com o fluxo atual e nunca vê o pop-up.

Quando o veículo **já tem** uma venda lançada, o modal abre mesmo assim, com o aviso *"Já existe uma venda lançada para este veículo — confirme que esta é uma nova venda."* Não bloqueia o envio: é o caso da revenda. Um carro pode ser vendido, ter o status revertido para disponível (correção, ou recompra via `entrada`, que reverte o status automaticamente) e ser vendido de verdade meses depois — se a existência de uma venda antiga travasse o pop-up, essa segunda venda nunca seria registrada e também não entraria na fila de pendências, porque a consulta derivada a excluiria. Era exatamente o buraco de receita que esta frente existe para fechar.

O controle da "virada" é um estado que **avança a cada salvamento bem-sucedido**, não o status capturado na montagem do formulário. Capturado só na montagem, ele sobreviveria ao `router.refresh()` e faria o modal reabrir a cada salvamento seguinte do mesmo veículo — inclusive um salvamento que só corrige a descrição.

### Fila de pendências: derivada, não persistida

A lista de vendas a registrar é uma **consulta**, não um estado gravado:

```
veículo com status = 'vendido'  E  sem transação type = 'saida'
```

Consequências desejadas: nenhuma migration, nenhuma coluna nova, nenhum registro "pendente" órfão. Registrou a venda → sai da lista. Voltou o status para disponível → sai da lista. O estado nunca diverge da realidade.

### Componentes

| Arquivo | Mudança |
|---|---|
| `lib/commission.ts` | **Novo.** Move `computeCommission` (hoje em `lib/db/sellers.ts:64`) para um módulo puro, importável pelo cliente. `lib/db/sellers.ts` passa a reexportar de lá — sem mudança para os callers de servidor. Motivo: `TransactionSlideOver.tsx:45-51` refaz a conta à mão porque não pode importar de `lib/db`; duas cópias da regra de comissão é bug esperando acontecer. |
| `lib/db/vehicles.ts` | **Novo:** `listPendingSales(tenantId): Promise<PendingSale[]>` e `hasSaleTransaction(tenantId, vehicleId): Promise<boolean>`. |
| `app/api/transactions/pendentes/route.ts` | **Novo.** `GET` via `withTenant` → `listPendingSales`. |
| `components/admin/RegistrarVendaModal.tsx` | **Novo.** O pop-up, com dois pontos de entrada. |
| `components/admin/VehicleForm.tsx` | Nova prop `hasSale`; dispara o modal quando o status virou `vendido` neste salvamento. |
| `app/admin/(protected)/veiculos/[id]/page.tsx` | Passa `hasSale` (server-side) para o formulário. |
| `app/admin/(protected)/transacoes/page.tsx` | Faixa "Vendas a registrar". |
| `components/admin/TransactionSlideOver.tsx` | Passa a importar `computeCommission` de `lib/commission.ts` em vez de recalcular inline. |

`TransactionSlideOver` continua existindo com o papel atual (transação avulsa, com escolha de veículo e de tipo). O modal novo é o caso específico "este veículo, esta venda" — veículo travado, tipo fixo em `saida`.

### `listPendingSales`

```sql
SELECT v.id, v.brand, v.model, v.year, v.sale_price, v.primary_photo_url, v.updated_at
FROM vehicles v
WHERE v.tenant_id = $1
  AND v.status = 'vendido'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.tenant_id = v.tenant_id
      AND t.vehicle_id = v.id
      AND t.type = 'saida'
  )
ORDER BY v.updated_at DESC
```

Tipo exportado:

```ts
export interface PendingSale {
  id: number;
  brand: string;
  model: string;
  year: number;
  sale_price: number;
  primary_photo_url: string | null;
  updated_at: string;
}
```

`hasSaleTransaction` usa o mesmo `NOT EXISTS` para um único veículo.

### `RegistrarVendaModal`

```ts
interface Props {
  vehicle: { id: number; brand: string; model: string; year: number; sale_price: number };
  onClose: () => void;   // fechou sem registrar
  onSaved: () => void;   // registrou com sucesso
}
```

Montado sob demanda pelos dois callers (`{aberto && <RegistrarVendaModal … />}`), no mesmo padrão do `TransactionSlideOver` — por isso não há prop `open`. Montar na hora garante que o valor pré-preenchido seja o preço de venda atual, e não um capturado quando a tela abriu.

- `Modal` do kit, `size="xl"`, título **"Registrar venda"**, descrição `"{Marca} {Modelo} {Ano} foi marcado como vendido. Confirme os dados para lançar no financeiro."`
- Campos, iguais aos de hoje: **valor** (pré-preenchido com `sale_price`, mesma máscara `displayToCents`/`centsToDisplay` do slide-over), **data** (padrão: hoje), **nome do comprador**, **telefone do comprador**, **vendedor** (lista de `/api/sellers` filtrada por `status === "ativo"`, com prévia da comissão via `computeCommission`), **observações**.
- Submit: `POST /api/transactions` com `type: "saida"` e `vehicle_id` do veículo. Nenhuma mudança de API ou de validação — `transactionInputSchema` já cobre esse payload.
- Rodapé: **"Agora não"** (ghost) e **"Registrar venda"** (primary, com `loading`).
- **Valor obrigatório:** valor vazio ou zero mostra *"Informe o valor da venda."* e não chama a API. O `required` do campo nunca dispararia sozinho — não há `<form>` em volta e o botão é `type="button"` —, e `displayToCents("")` devolve 0, que a API aceita como válido. Sem essa guarda, uma venda real virava lançamento de R$ 0,00.
- **Nenhuma via de fechamento funciona enquanto o salvamento está em voo** — nem "Agora não", nem Esc, nem clique fora, nem o X. Fechar no meio do request não cancelaria a requisição: a venda seria gravada enquanto a tela a trataria como pendente, e o registro seguinte pela faixa criaria uma **segunda** transação de saída. Nenhuma tela do painel apaga uma transação de saída, então essa duplicata só sairia com acesso direto ao banco — receita, custo e comissão dobrados no financeiro.
- Ao fechar sem registrar: `toast` informativo — *"Venda pendente. Você pode registrar depois em Transações."* (`toast` já é exportado por `components/ui`).
- Erro de API: mesma faixa vermelha usada no slide-over.

### Disparo no `VehicleForm`

- Nova prop opcional `hasSale?: boolean` (padrão `false`).
- Guarda o status inicial do veículo no `useState` inicial do componente.
- Depois do `PUT` bem-sucedido, em modo edição: abre o modal se `form.status === "vendido"` **e** o status inicial era diferente de `vendido` **e** `hasSale === false`. Caso contrário, mantém o `router.refresh()` atual.
- `onSaved` do modal → `router.refresh()`; o servidor devolve `hasSale === true` no próximo render, então o pop-up não reaparece.
- `onClose` sem registrar → `router.refresh()` também, para o status novo aparecer na tela.

### Faixa "Vendas a registrar"

Em `transacoes/page.tsx`, acima de "Vendas por mês", renderizada apenas quando houver pendências:

- Título **"Vendas a registrar (N)"**, subtítulo *"Marcados como vendidos, mas ainda sem lançamento no financeiro."*
- Uma linha por veículo: `{Marca} {Modelo} {Ano}` + preço anunciado + botão **"Registrar venda"**.
- A lista rola dentro do próprio bloco, mostrando cerca de cinco linhas. Lojas que já vinham marcando "Vendido" sem lançar a venda chegam com o passivo inteiro aqui — sem teto, uma loja com 40 vendas antigas empurraria as transações para fora da primeira tela. A contagem total continua no título, então nada fica escondido.
- Fechar o modal a partir da faixa recarrega os dados da página: sem isso a linha some do banco mas continua na tela, e o clique seguinte registraria a venda de novo.
- Visual de atenção coerente com o `SubscriptionBanner`: `bg-warning/10`, `border-warning/40`, texto `text-ink`.
- Salvou → `load()` recarrega tudo; a pendência some da lista sozinha.
- O `load()` da página passa a incluir `fetch("/api/transactions/pendentes")` no `Promise.all` existente.

### Fora de escopo (decidido)

- **Reverter `vendido` → `disponivel`** continua sem mexer na transação já lançada nem avisar sobre ela. É o comportamento de hoje; mudar isso é outra discussão.
- **Forma de pagamento, entrada e veículo na troca:** ficam de fora. Exigiriam migration e mudança no Financeiro.
- **Editar/excluir uma venda já registrada** pelo modal: fora de escopo, o caminho continua sendo Transações.

### Testes

- `tests/lib/commission.test.ts` — comissão só percentual, só fixa, ambas, e zero/nulo.
- `tests/api/transactions-pendentes.test.ts` — segue o padrão dos testes existentes (`vi.mock` de `@/lib/auth` e da camada de dados): tenant sem pendências devolve `[]`; veículo vendido sem `saida` aparece; veículo vendido **com** `saida` não aparece; rota exige tenant.

---

## Frente 2 — Esconder o preço da assinatura

Em `app/admin/(protected)/assinatura/page.tsx`:

- Remover a linha `{formatBRL(plan.priceMonthly)}/mês` (linha 40) e o import de `formatBRL`, que fica sem uso.
- O card mantém "Plano atual", o nome do plano e o selo No ar / Pendente.
- O valor real e o histórico de cobrança seguem acessíveis pelo botão **Gerenciar pagamento**, que leva ao Mercado Pago — fonte correta inclusive quando houve cupom.

Nada muda no site público, no checkout, nos e-mails ou no super-admin: `PricingCards`, `SignupForm`, `lib/checkout.ts` e `lib/coupon-pricing.ts` continuam intactos. Esse é hoje o único ponto do painel do lojista que exibe preço de plano.

---

## Frente 3 — Equilíbrio do painel no desktop

### Diagnóstico

`app/admin/(protected)/layout.tsx:38-45` monta `sidebar (w-60) + conteúdo (flex-1)`, e cada página aplica seu próprio `max-w-*` **sem `mx-auto`**. Em 1920px: 240 de sidebar + 1152 de conteúdo = 1392, sobrando 528px mortos à direita.

### Mudanças

**Sidebar** (`components/admin/AdminSidebar.tsx:106`): `w-60` → `w-60 lg:w-64 xl:w-72`. O drawer mobile continua com 240px.

**Canvas centralizado** (`app/admin/(protected)/layout.tsx`): `{children}` e o `PlatformFooter` passam a viver dentro de `<div className="mx-auto w-full max-w-7xl">`. O `SubscriptionBanner` fica **fora** do wrapper, atravessando a largura toda como hoje.

**Páginas de tabela** — trocam o teto próprio por `w-full`, para ocupar o canvas inteiro:

- `dashboard/page.tsx` e `dashboard/loading.tsx`
- `veiculos/page.tsx` e `veiculos/loading.tsx`
- `transacoes/page.tsx` e `transacoes/loading.tsx`
- `financeiro/page.tsx` e `financeiro/loading.tsx`

**Páginas de formulário e leitura** mantêm o teto atual (largura de leitura confortável), alinhadas à esquerda dentro do canvas centralizado — leitura proposital, não órfã: `assinatura` (2xl), `marketplace`, `analise`, `inteligencia`, `documentos/[id]` (3xl), `veiculos/novo`, `veiculos/[id]` (4xl), `vendedores`, `documentos` (5xl).

### Resultado

Em 1920px: sidebar 288 + canvas 1280 centralizado = 176px de folga de cada lado. Abaixo de ~1570px de janela o `mx-auto` não tem efeito e o layout fica idêntico ao de hoje — telas de MacBook não mudam.

### Detalhe aceito

`PlatformFooter` tem `mx-auto max-w-6xl` interno próprio. Dentro do canvas de 1280px, o texto do rodapé fica 64px recuado em relação ao conteúdo acima; a borda superior acompanha o canvas normalmente. Optamos por não mexer no componente, que é compartilhado com o super-admin — cujo layout não faz parte deste escopo.

### Verificação

Conferir em 1920px e 2560px que a folga fica simétrica e as tabelas de Veículos e Transações ganham largura; conferir em 1440px e 1280px que nada regride; conferir o drawer no mobile.

---

## Ordem sugerida

1. **Frente 3** (layout) — isolada, visual, valida rápido no navegador.
2. **Frente 2** (preço) — poucas linhas.
3. **Frente 1** (venda) — a maior, com testes.

Cada frente é independente: nenhuma depende do resultado da outra.
