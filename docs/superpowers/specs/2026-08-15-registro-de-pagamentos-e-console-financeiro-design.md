# Registro de pagamentos e console financeiro

**Data:** 2026-08-15
**Origem:** pedido do dono do produto — "melhorias no console e na parte de pagamentos, parte fiscal, e um console financeiro com faturamento, líquido, impostos"
**Escopo:** console super-admin (`console.autostand.com.br`) + webhook do Mercado Pago

---

## Contexto: dois buracos que reordenam o pedido

O pedido original tinha duas partes — emissão fiscal e console financeiro. A exploração encontrou uma terceira, que é **pré-requisito das outras duas**.

### 1. Não existe registro de pagamento

Não há tabela de pagamentos nem de faturas. `tenants` guarda `plan`, `subscription_status`, `mp_subscription_id`, `current_period_end` e `coupon_id` — quem *deveria* estar pagando e quanto. Não guarda **o que entrou**.

Um console de faturamento não é relatório sobre dado existente: **o dado não existe**.

### 2. O webhook descarta a notificação de cobrança

`app/api/webhooks/mercadopago/route.ts` trata apenas mudança de status de assinatura:

```js
if (body.type !== "preapproval" || !dataId) {
  return NextResponse.json({ received: true });
}
```

Quando o Mercado Pago cobra a mensalidade e notifica o pagamento, o sistema responde 200 e joga fora. Não falta só tabela — a notificação do dinheiro entrando **chega e é ignorada**.

### A decomposição

| Camada | O que é | Estado |
|---|---|---|
| 1 | Registrar os pagamentos | **este spec** |
| 2 | Console financeiro | **este spec** |
| 3 | Emissão automática de NFS-e | spec próprio, depois |

A 2 e a 3 são independentes entre si; as duas dependem da 1.

## Decisões tomadas antes do design

| Decisão | Escolha | Razão |
|---|---|---|
| Regime tributário | **Simples Nacional** | confirmado pelo dono; uma guia (DAS), ISS embutido |
| Fonte da verdade sobre receita | **Registro próprio, alimentado pelo webhook** | a camada 3 precisa de um registro estável e nosso, com lugar para carimbar "nota emitida". Consultar o MP na hora não tem onde carimbar |
| Recuperar webhook perdido | **Botão de reconciliação, não cron** | com um cliente, cron é maquinário para um problema que não existe. Botão **mostra a diferença** em vez de corrigir em silêncio |
| Emissão fiscal agora | **Manual**, com fila no console | ver "Camada 3" abaixo |
| Perguntas do console | **as quatro** — caixa, imposto, recorrência, pendência fiscal | todas saem da mesma fonte |
| Exibir valor de imposto | **Não, até o contador validar** | número de imposto errado vira decisão errada sobre dinheiro. Calculado e testado desde já; exibição atrás de flag |

---

## Modelo de dados

### Tabela nova: `payments`

Uma linha por pagamento aprovado.

| coluna | tipo | nota |
|---|---|---|
| `id` | serial PK | |
| `tenant_id` | integer | → `tenants`, **`ON DELETE SET NULL`** |
| `tenant_name` | text NOT NULL | **snapshot** do pagador no momento do pagamento |
| `tenant_document` | text | CNPJ/CPF, snapshot |
| `plan` | text | plano cobrado, snapshot |
| `mp_payment_id` | text NOT NULL **UNIQUE** | idempotência |
| `mp_preapproval_id` | text | assinatura de origem |
| `gross_cents` | integer NOT NULL | valor cobrado |
| `fee_cents` | integer | taxa do Mercado Pago |
| `net_cents` | integer | líquido creditado |
| `status` | text NOT NULL | `approved` \| `refunded` \| `chargeback` |
| `paid_at` | timestamp NOT NULL | quando o MP aprovou, não quando gravamos |
| `coupon_id` | integer | → `coupons`, `SET NULL` |
| `nfse_issued_at` | timestamp | nulo até a nota ser emitida |
| `nfse_number` | text | número da nota emitida |
| `incomplete` | boolean NOT NULL default false | taxa ausente na resposta do MP |
| `created_at` | timestamp | default now |

Índices: `(paid_at)` para o recorte por período; `(tenant_id)`; único em `mp_payment_id`.

### Três decisões que não são óbvias

**`tenant_id` com `SET NULL`, nunca cascade.** Todas as tabelas do sistema apagam em cascata com o tenant. Esta não pode: excluir uma concessionária apagaria registro fiscal, que a lei obriga a guardar. Por isso nome e documento do pagador ficam **copiados na linha** — a nota precisa dizer quem pagou naquele dia, não quem é o tenant hoje. Cliente que sai deixa o histórico íntegro e emitível.

**Bruto, taxa e líquido são três colunas, não uma conta.** A taxa do MP muda com o tempo e por meio de pagamento. Guardar o que ele efetivamente cobrou *naquele* pagamento é o que mantém o histórico verdadeiro daqui a um ano. `incomplete` marca o caso em que a taxa não veio — melhor um número marcado como duvidoso que um número inventado.

**`nfse_issued_at`/`nfse_number` já nascem aqui**, mesmo a camada 3 sendo outro spec. Sem eles, a fila de pendência fiscal nunca esvazia. Com eles, o fluxo manual fecha: emite no portal, cola o número, a pendência some — e a automação futura preenche os mesmos campos, sem migração.

---

## Como o pagamento entra

### Caminho principal — webhook

O webhook passa a tratar a notificação de cobrança que hoje cai no `return` de cima.

> **A confirmar na implementação:** o tipo exato que o Mercado Pago usa para cobrança recorrente de assinatura (`payment` / `authorized_payment`). Confirmar na documentação deles, não presumir.

Ao receber: busca o pagamento na API do MP para obter valor e taxa — **não confia no corpo da notificação** — e grava com `ON CONFLICT (mp_payment_id) DO NOTHING`.

A notificação de `preapproval` continua funcionando como hoje, sem alteração.

### Caminho de segurança — reconciliação

Botão no console. Escolhe-se um período; ele lista o que o MP tem e nós não temos, e importa sob confirmação.

**Mostra a diferença antes de importar.** Webhook perdido é informação sobre o sistema, não apenas uma linha faltando — corrigir em silêncio esconde que o caminho principal falhou.

Os dois caminhos usam a mesma função de gravação e a mesma trava de idempotência: importar duas vezes é inofensivo.

---

## Console financeiro

Em `/superadmin/financeiro`, com seletor de período (mês corrente por padrão). Quatro blocos.

### Caixa
Bruto recebido, taxa do Mercado Pago, e o resultado — rotulado **"líquido antes de imposto"**, nunca "líquido" sozinho.

> Esse rótulo é requisito, não estilo. Enquanto o bloco de imposto estiver desligado (ver abaixo), "líquido" sem qualificação seria lido como dinheiro disponível, e é justamente o erro que desligar o imposto existe para evitar. O número que sobra ainda tem o DAS pela frente.

### Imposto — **desligado até validação contábil**

**Decisão do dono (15/08/2026): o console não exibe valor de imposto — nem DAS estimado, nem alíquota efetiva — enquanto o cálculo não for validado pelo contador.**

O bloco existe e é visível, mas mostra apenas:

- o estado: *"cálculo de imposto aguardando validação contábil"*
- os **insumos**, que são fato e não estimativa: RBT12 apurado do próprio registro de pagamentos, anexo configurado, e desde quando
- nenhum resultado: sem DAS, sem alíquota

Os insumos ficam à vista de propósito — é o que o contador precisa para conferir a conta. O que fica escondido é o número que induziria decisão.

**Ligar é mudança de configuração, não deploy de lógica.** O cálculo é implementado e testado desde já; uma flag decide se o resultado aparece. Quando o contador validar, vira `true` e o bloco passa a mostrar DAS estimado, alíquota efetiva e vencimento.

> Quando ligado, "estimado" é literal e precisa aparecer na tela. O DAS oficial é apurado no PGDAS-D, que considera o que este sistema não conhece — outras receitas, retenções, ajustes. O número serve para **separar dinheiro**, não para pagar a guia.

### Recorrência
MRR, ativos por plano, inadimplentes, cancelados no período. Sai de `tenants`, não do registro de pagamentos.

### Pendência fiscal
Pagamentos sem `nfse_issued_at`, com campo para registrar o número depois de emitir.

---

## O cálculo do Simples

A alíquota efetiva no Simples não é fixa: depende da **receita bruta dos últimos 12 meses (RBT12)** e sobe por faixa, com alíquota nominal e parcela a deduzir tabeladas por anexo e faixa.

**A decisão de desenho é exibir os insumos, não só o resultado.** O console mostra de onde saiu cada número. Errado, fica visivelmente errado — e o contador confere olhando a tela, sem auditar código.

Três pontos que a implementação precisa acertar:

**A SYNQO abriu em 02/06/2026 e não tem 12 meses de receita.** Para empresa nova, o Simples manda proporcionalizar a receita acumulada em vez de somar direto. Somando direto, a alíquota sai da faixa errada.

> **Este cálculo precisa ser confirmado pelo contador antes de o número aparecer.** O sistema implementa a conta; não assina por ela. Por decisão do dono, o resultado fica **oculto atrás de uma flag** até essa validação — ver o bloco "Imposto" acima. O cálculo é implementado e testado normalmente; só não é exibido.

**O anexo (III ou V) é configuração, não constante.** Depende do fator R (folha ÷ receita bruta), que muda mês a mês com o pró-labore. Configurável significa: funciona hoje sem a questão fechada, e corrigir depois é trocar um valor. O console mostra qual anexo está configurado e desde quando — número de imposto sem procedência visível é pior que número nenhum.

**A tabela do Simples fica em arquivo de dados**, com fonte citada e data de vigência — não espalhada no código. Ela vem de lei e muda por decreto.

---

## Estorno

Pagamento estornado **não vira delete**: muda de `status`. O período subtrai, a linha permanece para auditoria.

Se já houver nota emitida contra ele, o console alerta — cancelamento de NFS-e é processo próprio e pertence à camada 3.

---

## Bordas

| Situação | Comportamento |
|---|---|
| Pagamento sem tenant correspondente | Grava assim mesmo, sinalizado. Perder dinheiro do registro é pior que uma linha órfã |
| Taxa ausente na resposta do MP | `net = gross`, `incomplete = true`. Nunca inventar a taxa |
| Pagamento de mês já apurado chegando atrasado | Aparece no período a que pertence, com aviso de que aquele mês mudou |
| Webhook repetido | `ON CONFLICT DO NOTHING` — uma linha só |
| Falha ao buscar o pagamento no MP | Não grava linha pela metade; deixa para a reconciliação |

---

## Testes

**Puros** — a matemática do Simples é módulo isolado, sem banco: alíquota efetiva por faixa, proporcionalização de empresa nova, virada de faixa, agregação por período com estorno no meio.

> O cálculo é testado **mesmo estando oculto na tela**. Testá-lo agora é o que permite ao contador validar a conta contra casos concretos em vez de ler código — e é o que torna ligar a flag uma decisão de um passo, sem implementação pendente atrás dela.

**Da flag de imposto** — com ela desligada, nenhum valor de imposto aparece na resposta da página; com ela ligada, aparece. O teste cobre os dois estados, para que desligar não vire uma tela quebrada nem ligar exponha um cálculo que ninguém exercitou.

**Webhook** — notificação repetida grava uma linha só; tipo que não é pagamento continua ignorado; falha na busca ao MP não grava linha parcial.

**Reconciliação** — detecta o que falta, importa sem duplicar, não apaga o que existe.

**Fora de cobertura automatizada, de propósito:** os valores da tabela do Simples. Vêm de lei e um teste que repete a constante só prova que ela foi copiada duas vezes.

> **Nota sobre a suíte:** os testes de banco deste repo mockam `@/lib/db/client`, o que os torna cegos a filtro de query — remover um `WHERE tenant_id` mantém a suíte verde. Para dado financeiro isso é sério. Este spec **não** resolve a lacuna (é frente própria, já identificada), mas a implementação deve preferir lógica em módulo puro sempre que possível, justamente para não depender desses mocks.

---

## Camada 3 — emissão fiscal (spec futuro, com prazo legal)

Registrado aqui para a decisão não se perder.

**A Resolução CGSN nº 191/2026 (04/08/2026) revogou a 189/2026 e estabeleceu que, a partir de 1º de novembro de 2026, ME e EPP optantes do Simples que prestam serviço com ISS devem emitir NFS-e exclusivamente pelo Emissor Nacional — web ou API — independentemente de o município ter aderido.**

Consequências:

- **A pergunta "Maceió aderiu?" é irrelevante** para a SYNQO. O alvo é um emissor federal único, da Receita.
- **Muda a recomendação de arquitetura.** O argumento contra integração direta era a fragmentação entre milhares de municípios. Com uma API nacional única e documentada, integração direta deixa de ser a pior opção e vira candidata séria; um provedor perde boa parte da razão de existir neste caso.
- **Até 01/11/2026** a emissão pode ser manual. A partir daí, manual significa o emissor web da Receita, não o portal da prefeitura.

**Decisão do dono:** começar manual, buscar o certificado depois.

**Pré-requisito conhecido:** e-CNPJ **A1** (arquivo — o A3 é token físico e não serve para automação), emitido por Autoridade Certificadora credenciada pela ICP-Brasil (lista oficial em `iti.gov.br`). A confirmar com o contador se o acesso ao Emissor Nacional se resolve por login gov.br para emissão manual; para a API, o certificado é o caminho.

Inscrição municipal e autorização para emitir em Maceió: **já existem** (confirmado pelo dono).

---

## Fora de escopo

- Emissão automática de NFS-e (camada 3)
- Cron de reconciliação (o botão basta no volume atual)
- Conciliação bancária / extrato do Mercado Pago além dos pagamentos de assinatura
- Relatório para o contador em formato de exportação fiscal
- Cálculo de fator R a partir da folha (o anexo entra como configuração)
