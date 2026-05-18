---
title: Onboarding — Playbook de campo
tags:
  - operacao
  - vendas
aliases:
  - Playbook
  - Onboarding de loja
---

# Onboarding — Playbook de campo

> [!abstract] O que é
> O passo a passo para visitar uma multimarca, fechar e colocar a loja no ar. Enquanto o pagamento é manual (cobrança direta + mês grátis), todo o onboarding é feito pelo `/superadmin` — sem Stripe.

## O movimento que fecha

Não chegue oferecendo "imagine seu site". Chegue mostrando **o site dela já existindo**. Antes de cada visita, pré-crie a loja com o nome, as cores e 2-3 carros que ela já anuncia no Instagram/OLX. Na loja, você abre `slug.autostand.com.br` e o dono vê a própria vitrine pronta.

## Antes da visita — checklist de coleta

Junte do Instagram/OLX da loja, ou ligue pedindo:

- [ ] **Nome** da concessionária e como querem o endereço (`slug`).
- [ ] **Logo** (imagem) — ou o nome estilizado.
- [ ] **Cores** da marca — primária e de destaque.
- [ ] **WhatsApp** com DDI (ex.: `5582999999999`).
- [ ] **Cidade**, **horário de funcionamento**, **Instagram**, **e-mail**.
- [ ] **2 a 3 veículos** para a vitrine nascer com conteúdo — marca, modelo, versão, ano, km, preço e **fotos**.

## Pré-criar a loja (`/superadmin`)

1. `/superadmin` → **Concessionárias** → **Nova**.
2. Preencha identificação, **Plano: Pro** (o mês grátis é o Pro liberado), identidade visual e contato. Deixe o domínio próprio em branco — a loja nasce em `slug.autostand.com.br`.
3. Crie o **administrador** da loja (nome, e-mail, senha) — são as credenciais que você entrega ao dono.
4. Entre no painel da loja (`slug.autostand.com.br/admin`) e cadastre os 2-3 veículos em **Veículos → Novo** (com fotos).
5. Em **Marketplace**, ligue a adesão para a loja aparecer também no portal AutoStand.

> [!tip] A loja já nasce no ar
> Tenant criado pelo `/superadmin` nasce com status **ativo** — o site vai ao ar na hora. Não depende de pagamento (decisão de [[Decisões|negócio]]: billing manual por enquanto).

## Na visita

- Abra a **demo** (`demo.autostand.com.br`) para mostrar o produto completo — vitrine, marketplace, gerador de post.
- Abra **a loja dela** já pré-criada. Mostre o painel: cadastro de veículo, funil de leads, WhatsApp em 1 clique.
- Combine o **mês grátis** e entregue as credenciais do administrador.

## Fechou — e depois

- O dono entra no `/admin` da loja e completa o estoque.
- **Mês grátis:** a plataforma não controla trial — **anote a data de início**. Ao fim dos 30 dias, cobre direto.
- Se o cliente sair ou não pagar: `/superadmin` → editar a loja → status **Suspensa**. O site sai do ar; o painel continua acessível (decisão da Fase 6 do [[Milestone 2]]).

## Pendências de plataforma

- Deploy precisa estar feito antes das visitas — ver [[Desenvolvimento#Deploy (Vercel)]].
- Billing automático (Stripe) é [[Milestone 2]] Fase 2 — adiado até haver volume que justifique.
