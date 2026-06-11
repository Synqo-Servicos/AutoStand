# Fundamentos do Produto — AutoStand

> Base conceitual compartilhada por todos os manuais. Define o que é o AutoStand,
> para quem, qual problema resolve e como se estrutura.

---

## 1. O que é o AutoStand

O **AutoStand** é uma plataforma **SaaS** (software por assinatura) feita sob medida para
**revendas de veículos seminovos multimarca**. Para cada concessionária cliente, o produto
entrega um pacote pronto e operacional:

- **Site público próprio** — uma vitrine de estoque profissional, com a marca da loja, hospedada em subdomínio (`loja.autostand.com.br`) ou domínio próprio.
- **Painel de gestão** — controle de estoque, financeiro, leads (CRM), vendedores e documentos.
- **Presença no marketplace AutoStand** — uma vitrine central que reúne o estoque de várias lojas e gera contatos qualificados.

Tudo roda numa única aplicação. O que separa uma loja da outra é o **multi-tenancy**
(ver seção 5).

> **Frase-síntese:** o AutoStand não é "uma plataforma de sites" — é a **operação de
> venda digital da concessionária**. O site é o começo; o valor que retém é a gestão
> e a automação do dia a dia.

---

## 2. O problema que resolve

A revenda multimarca independente típica opera no improviso:

- Estoque controlado em **caderno ou planilha solta**, sem visão de margem real.
- Carros anunciados em **portais de terceiros** que cobram caro e tratam a loja como anúncio genérico, sem marca própria.
- **Leads perdidos** — contatos do WhatsApp e do Instagram que somem sem acompanhamento.
- **Financeiro no escuro** — o lojista sabe quanto vendeu, mas não quanto lucrou por carro depois de custos, despesas e comissões.
- Nenhum **dado de mercado**: o que o comprador realmente procura na região.

O AutoStand integra **estoque, vitrine, CRM, financeiro e comissões** em um só lugar,
com linguagem e telas afiadas para venda de carro — não um ERP genérico adaptado.

---

## 3. Por que nichado em concessionárias

A plataforma é **deliberadamente especializada**. O modelo de dados e as telas falam a
língua do setor: marca, modelo, versão, ano/modelo e ano/fabricação, quilometragem,
câmbio, combustível, carroceria, blindagem, único dono, código FIPE, placa. Generalizar
para "qualquer catálogo" foi avaliado e descartado — a especialização é o diferencial.

O alvo são **revendas multimarca independentes** (loja pequena com 5–15 carros, a típica
com ~30, teto realista ~80). Concessionárias de marca (grandes grupos) **estão fora do
escopo**. Por isso não há limite de veículos por plano — o mercado é homogêneo demais
para a contagem de carros segmentar preços.

---

## 4. Atores do sistema

| Ator | Quem é | Onde atua | Tem login? |
|---|---|---|---|
| **Super-admin** | O operador/dono da plataforma AutoStand. | Console `/superadmin`. | Sim (staff) |
| **Admin da concessionária** (`tenant_admin`) | O gestor de uma loja cliente. | Painel `/admin`. | Sim (staff) |
| **Visitante** | Consumidor procurando carro. | Site público da loja e marketplace. | Não |
| **Lead** | Visitante que deixou contato ("Tenho interesse"). | Capturado pelo site → vira card no CRM da loja. | Não |
| **Parceiro** | Indica clientes em troca de comissão/desconto. | Recebe um link de indicação; não acessa o sistema. | Não |

> **Não existe conta de consumidor final.** Quem compra carro usado o faz a cada 5+ anos —
> login não entregaria valor e só adicionaria fricção. O consumidor interage como **lead**:
> preenche um formulário de interesse, sem senha. A base de usuários é **só para staff**
> (super-admin e admins de loja).

---

## 5. As três superfícies do produto

O produto tem três "faces", servidas pela mesma aplicação, e que **nunca devem ser
confundidas** (têm públicos e até identidades visuais diferentes):

### 5.1 Console da Plataforma — `/superadmin`
Acessível apenas nos hosts da plataforma (`autostand.com.br`). É onde o operador AutoStand
administra o negócio: métricas globais, cadastro de concessionárias, criação do admin de
cada loja, parceiros e cupons. **Veste a marca AutoStand.**

### 5.2 Painel da Loja — `/admin`
A área logada do lojista. Dashboard, veículos, leads, financeiro, transações, vendedores,
documentos, personalização, marketplace e (nos planos superiores) inteligência e IA.
**Veste a marca AutoStand.**

### 5.3 Site público da concessionária (storefront)
Servido no domínio/subdomínio do tenant. A vitrine que o comprador vê: hero, estoque com
filtros, página de detalhe do veículo, captura de lead, WhatsApp. **Veste a marca do
cliente (whitelabel)** — cores, logo e conteúdo são da loja. O AutoStand aparece apenas
de forma discreta no rodapé.

> Além dessas, há o **marketplace agregado** (`autostand.com.br/comprar`), uma vitrine
> central pública que reúne o estoque de todas as lojas que optaram por participar.

---

## 6. Multi-tenancy (em linguagem de produto)

"Multi-tenant" significa que **uma única instalação serve muitas lojas**, com isolamento
total de dados entre elas. Na prática:

- A plataforma descobre **qual loja** está sendo acessada pelo **endereço (domínio)**:
  - `autostand.com.br` → host da plataforma (marketing + marketplace, sem loja específica).
  - `nomedaloja.autostand.com.br` → loja identificada pelo seu **slug** (apelido único).
  - `www.minhaloja.com.br` (domínio próprio) → loja identificada pelo domínio customizado.
- Veículos, leads, vendedores e usuários **sempre** pertencem a uma loja e nunca vazam para outra.
- **Exceção controlada:** o marketplace agregado lê, de forma somente-leitura, os veículos de **todas** as lojas que ativaram a participação.

O **slug** é o apelido da loja na URL (ex.: `autoprime` → `autoprime.autostand.com.br`).
É gerado automaticamente a partir do nome no cadastro e pode ser ajustado.

---

## 7. Ciclo de vida de uma loja (status)

Toda concessionária passa por estados que controlam se o site está no ar:

| Status | Significado | Site no ar? |
|---|---|---|
| **incompleta** (`incomplete`) | Cadastro feito, aguardando confirmação do 1º pagamento. | Não |
| **ativa** (`active`) | Pagamento confirmado. | Sim |
| **suspensa** (`suspended`) | Pagamento com problema ou suspensão manual. | Não |
| **arquivada** | Loja removida. | Não |

Quando o site não está no ar, o visitante vê uma página educada de "loja indisponível".

---

## 8. Modelo de negócio

- **Assinatura mensal recorrente**, cobrada via **Mercado Pago** (modelo *Preapproval*).
- **Três planos** diferenciados por funcionalidade — sem limite de veículos. Detalhes em [`04-Posicionamento-e-Vendas.md`](04-Posicionamento-e-Vendas.md).
- **Sem trial:** o lojista paga a 1ª mensalidade no cadastro e o site vai ao ar com a confirmação. A loja-demo serve de "experimente antes".
- **Sem comissão por venda** e **sem fidelidade** — mensalidade fixa.
- **Cadastro self-service:** o lojista chega na landing, escolhe o plano, preenche os dados e assina sozinho. A loja é provisionada automaticamente.
- **Canal de indicação:** parceiros têm links próprios que aplicam cupons de desconto e creditam a indicação.
- **Inadimplência:** assinatura vencida → site suspenso automaticamente.

---

## 9. Glossário essencial

| Termo | Significado |
|---|---|
| **Tenant** | Uma loja/concessionária cliente. Cada uma é um "tenant" isolado. |
| **Slug** | Apelido único da loja na URL (ex.: `autoprime`). |
| **Storefront** | O site público da loja (vitrine). |
| **Marketplace** | Vitrine central pública que agrega veículos de várias lojas. |
| **Lead** | Contato deixado por um visitante interessado em um veículo. |
| **Whitelabel** | O site da loja usa a marca dela, não a do AutoStand. |
| **Capability** | Um recurso que um plano libera ou não (ex.: domínio próprio). |
| **Parceiro** | Indicador externo que traz clientes via link próprio. |
| **Cupom** | Código de desconto aplicado na assinatura. |
| **Preapproval** | Assinatura recorrente no Mercado Pago. |

---

### Próximos documentos
- Funcionalidades em detalhe → [`02-Funcionalidades.md`](02-Funcionalidades.md)
- Identidade e design → [`03-Marca-e-Design.md`](03-Marca-e-Design.md)
- Posicionamento e vendas → [`04-Posicionamento-e-Vendas.md`](04-Posicionamento-e-Vendas.md)
