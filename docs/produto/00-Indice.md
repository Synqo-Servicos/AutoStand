# Documentação de Produto — AutoStand

> Conjunto de documentação consolidada sobre o produto AutoStand, extraída diretamente
> do código-fonte (fonte da verdade) e das notas de produto do projeto.
> Serve de **material-base** para a produção dos três manuais oficiais.

## Para que serve este conjunto

Estes documentos são a fundação a partir da qual serão escritos:

| Manual futuro | Documento-base principal | Documentos de apoio |
|---|---|---|
| **Manual da Marca** (cores, design, princípios, referências) | [`03-Marca-e-Design.md`](03-Marca-e-Design.md) | `01-Fundamentos.md` |
| **Manual do Vendedor** (pitch em concessionárias, planos, objeções) | [`04-Posicionamento-e-Vendas.md`](04-Posicionamento-e-Vendas.md) | `01-Fundamentos.md`, `02-Funcionalidades.md` |
| **Manual do Usuário** (uso diário da plataforma) | [`02-Funcionalidades.md`](02-Funcionalidades.md) | `01-Fundamentos.md` |

## Os documentos

1. **[`01-Fundamentos.md`](01-Fundamentos.md)** — O que é o AutoStand, o problema que resolve, os atores, as três superfícies do produto, o modelo multi-tenant e o modelo de negócio. Leitura obrigatória antes dos demais.
2. **[`02-Funcionalidades.md`](02-Funcionalidades.md)** — Referência completa de todas as funcionalidades: painel da loja, console da plataforma, site público e marketplace. Em linguagem de produto.
3. **[`03-Marca-e-Design.md`](03-Marca-e-Design.md)** — Identidade visual, sistema de cores, tipografia, logo, componentes, princípios e tom de voz.
4. **[`04-Posicionamento-e-Vendas.md`](04-Posicionamento-e-Vendas.md)** — Proposta de valor, público-alvo, planos e preços, diferenciais, modelo comercial e roteiro de venda.

## Fonte da verdade e data

- **Base:** código-fonte do repositório AutoStand (Next.js App Router).
- **Gerado em:** 10 de junho de 2026.
- **Princípio:** onde o código e as notas antigas divergem, **vale o código**. As divergências conhecidas estão listadas abaixo.

## ✅ Divergências entre código e notas antigas — reconciliadas

Ao consolidar, encontramos pontos onde a documentação interna antiga (`docs/*.md` no nível
raiz) estava **desatualizada** em relação ao código. Todos foram **corrigidos em jun/2026**
para seguir o código (fonte da verdade):

| Tema | Nota antiga dizia | Código (vigente) | Arquivos corrigidos |
|---|---|---|---|
| Preço do plano Básico | R$ 149 | **R$ 169,90** | `Planos e Preços.md`, `Decisões.md`, `Milestone 2.md` |
| Preço do plano Premium | R$ 599 | **R$ 499,90** | `Planos e Preços.md`, `Decisões.md`, `Milestone 2.md` |
| Gateway de pagamento | Stripe | **Mercado Pago** (Preapproval) | `Visão Geral.md`, `Decisões.md`, `Modelo de Dados.md`, `Roadmap.md`, `Onboarding.md`, `SPEC-evolucao.md`, `Milestone 2.md` |

> Nos registros históricos (`Decisões.md`, `Milestone 2.md`), a decisão original pelo Stripe
> foi **marcada como substituída** pela migração para Mercado Pago — o histórico foi
> preservado, não apagado. As colunas legadas `stripe_*` continuam no schema, sem uso.
