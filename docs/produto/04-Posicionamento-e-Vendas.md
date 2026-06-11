# Posicionamento e Vendas — AutoStand

> Proposta de valor, público-alvo, planos, diferenciais e roteiro comercial.
> Base para o **Manual do Vendedor** (representante que visita concessionárias).
> Preços e capacidades conferidos no código (`lib/plans.ts`). Pré-requisito:
> [`01-Fundamentos.md`](01-Fundamentos.md).

---

## 1. Pitch em uma frase

> **"Venda mais. Improvise menos."**
> O AutoStand dá à sua revenda um site próprio, um painel de gestão e presença num
> marketplace — estoque, leads, financeiro e comissões num só lugar.

E o reforço de posicionamento:

> Não é só um sistema. É um **sócio operacional**. Mensalidade fixa, sem comissão por
> venda, sem fidelidade. O site entra no ar com o primeiro pagamento.

---

## 2. As dores do lojista (o que abrir na conversa)

O vendedor deve fazer o lojista **reconhecer a própria dor** antes de falar de recurso:

| Dor | Como soa na boca do lojista |
|---|---|
| Estoque no caderno/planilha | "Eu sei mais ou menos o que tenho no pátio." |
| Margem no escuro | "Vendi, mas no fim do mês não sei quanto sobrou de cada carro." |
| Dependência de portal pago | "Pago caro pro portal e ainda apareço igual a todo mundo." |
| Leads que somem | "Entra gente no WhatsApp e no Direct, mas a gente perde o controle." |
| Sem marca própria na internet | "Meu cliente não me acha no Google, só no portal." |
| Sem dado de mercado | "Compro carro no feeling, não sei o que tá saindo na região." |

---

## 3. Proposta de valor — os três pilares

A comunicação do produto se organiza em três pilares. Use-os como espinha dorsal do pitch:

### 🎯 Controle — "Cada número no seu lugar"
Estoque, vendas, CRM, comissões e financeiro **conectados e em tempo real**. Da entrada do
veículo à comissão do vendedor, tudo num fluxo só — sem planilha solta, sem retrabalho.

### 🔍 Clareza — "Software que respeita o lojista"
Interface limpa, fluxos curtos, linguagem direta. Feito para quem vende carro, não para
quem opera ERP. O lojista entende a tela sem treinamento longo.

### 🤝 Parceria — "Do lado da loja, todo dia"
Mensalidade fixa (o ganho do AutoStand não depende de cobrar comissão da venda da loja),
atendimento consultivo e evolução contínua do produto.

---

## 4. Público-alvo (quem é cliente — e quem não é)

**É cliente:** revendas multimarca **independentes**.
- Loja pequena: 5–15 carros. Loja típica: ~30. Teto realista: ~80.
- Geralmente dono-operador, sem equipe de TI, que hoje usa planilha/caderno + WhatsApp + Instagram + portal pago.

**Não é cliente (fora do escopo):** concessionárias de **marca** / grandes grupos
(ex.: complexos com bandeira de montadora), que têm sistemas próprios e outra operação.

> Por isso **não há limite de veículos** nos planos: o mercado-alvo é homogêneo demais
> para a contagem de carros separar tiers. A diferenciação é **100% por funcionalidade**.

---

## 5. Planos e preços

> Valores e recursos conforme `lib/plans.ts` (fonte da verdade, jun/2026).
> Sem limite de veículos em nenhum plano.

| | **Básico** | **Pro** ⭐ *(mais escolhido)* | **Premium** |
|---|---|---|---|
| **Preço/mês** | **R$ 169,90** | **R$ 349,90** | **R$ 499,90** |
| Site + vitrine + CRM de leads | ✓ | ✓ | ✓ |
| Cores da marca | ✓ | ✓ | ✓ |
| Subdomínio `loja.autostand.com.br` | ✓ | ✓ | ✓ |
| Painel completo (estoque, financeiro, transações, vendedores, documentos) | ✓ | ✓ | ✓ |
| Domínio próprio | — | ✓ | ✓ |
| Customização de layout (hero, cards, seções) | — | ✓ | ✓ |
| Gerador de post para Instagram | — | ✓ | ✓ |
| Análise de IA da vitrine | — | — | ✓ |
| Inteligência de demanda | — | — | ✓ |

### A leitura de cada plano (como recomendar)
- **Básico — "estar online de forma decente":** o essencial para tirar a loja do caderno e ter site com a cor da marca no subdomínio. Para quem está começando a se digitalizar.
- **Pro — "parecer uma marca de verdade":** domínio próprio, site customizado e gerador de post para Instagram. Para a loja que quer presença profissional. **É o plano âncora** (recomende-o por padrão).
- **Premium — "o sistema decidindo junto":** tudo do Pro + análise de IA da vitrine + inteligência de demanda (saber o que o mercado procura). Para quem quer vantagem de dado que **nenhum concorrente entrega**.

---

## 6. Diferenciais competitivos (por que AutoStand e não um portal)

1. **Marca própria, não anúncio genérico.** Site do lojista com domínio e cara próprios — vs. ser "mais um" no portal.
2. **Marketplace que gera lead para a loja certa.** O contato cai direto no CRM da loja dona do veículo, não num intermediário.
3. **Gestão de verdade, não só vitrine.** Margem real por carro (com custos e despesas), financeiro, comissões, transações.
4. **Inteligência de demanda (Premium).** O que o mercado da região procura — dado que portal nenhum devolve ao lojista.
5. **Sem comissão por venda.** Mensalidade fixa; o AutoStand não tira um percentual de cada carro vendido.
6. **Especializado em revenda.** Telas e dados afiados para carro (FIPE, câmbio, blindagem, único dono), não um sistema genérico.
7. **No ar rápido e self-service.** Em poucos minutos a loja tem site e painel.

---

## 7. Modelo comercial

- **Assinatura mensal** via **Mercado Pago** (recorrência automática).
- **Sem trial:** paga a 1ª mensalidade no cadastro e o site vai ao ar com a confirmação. A loja-demo serve de "experimente antes".
- **Sem fidelidade.**
- **Cadastro self-service** em `autostand.com.br/assinar` — o vendedor pode acompanhar o lojista preenchendo na hora.
- **Inadimplência:** assinatura vencida suspende o site automaticamente.
- *(Roadmap: plano anual com desconto — 2 meses grátis — recomendado, a confirmar comercialmente.)*

---

## 8. Canal de parceiros e cupons (ferramenta do vendedor)

- **Link de parceiro:** cada vendedor/indicador pode ter um código próprio. O link `autostand.com.br/assinar?parceiro=SEU-CODIGO` aplica desconto ao lojista e **credita a indicação**.
- **Cupons:** códigos promocionais (percentual, valor fixo ou **1º mês grátis**) que o lojista digita no cadastro, com validade e limite de usos.
- Use cupom/link como **fechador**: "consigo aplicar um desconto no seu primeiro mês com este código".

---

## 9. Objeções comuns e respostas

| Objeção | Resposta |
|---|---|
| "Já pago um portal." | O portal te mostra como anúncio genérico e não te dá gestão. Aqui você tem **site próprio + painel + leads no seu CRM**, e ainda aparece no nosso marketplace. |
| "É caro." | É mensalidade fixa **sem comissão por venda**. Um carro a mais vendido no mês já paga o plano — e o painel te mostra a margem real de cada um. |
| "Não tenho tempo/saco pra sistema." | Foi feito pra revenda, não pra TI. Cadastra o carro com foto e tá no ar. Fluxos curtos, sem treinamento longo. |
| "Tenho poucos carros." | Não tem limite de veículos e o Básico cabe no bolso de quem está começando. Você cresce de plano quando quiser. |
| "E se eu não gostar?" | Sem fidelidade. E tem a loja-demo pra você ver funcionando antes. |
| "Meu cliente compra no WhatsApp mesmo." | Ótimo — o site e o marketplace **alimentam seu WhatsApp** com leads qualificados e organizados, sem você perder contato. |

---

## 10. Roteiro de demonstração sugerido

1. **Abrir pela dor** (seção 2): deixe o lojista falar como controla estoque, margem e leads hoje.
2. **Mostrar a loja-demo** no celular: vitrine bonita com a marca da loja → "isso aqui é seu, no seu domínio".
3. **Detalhe do veículo + lead:** mostre o "Tenho interesse" caindo como card no CRM.
4. **Painel — Financeiro:** mostre a **margem real por carro** (custo + despesas). É o "momento aha" do dono.
5. **Marketplace:** "seu estoque também aparece aqui e o lead vem direto pra você."
6. **Premium (se fizer sentido):** inteligência de demanda — "o que o mercado da sua região procura".
7. **Fechar:** recomende **Pro**, aplique cupom/link de parceiro e acompanhe o cadastro em `/assinar`.

---

## 11. Pontos de prova (frases prontas)

- "Site próprio, com a sua marca, no ar com o primeiro pagamento."
- "Cada lead do site e do marketplace vira um card no seu CRM — você não perde contato."
- "Você passa a saber a margem real de cada carro, não só o que vendeu."
- "Mensalidade fixa. Sem comissão por venda. Sem fidelidade."
- "No Premium, o sistema te diz o que o mercado está procurando."
