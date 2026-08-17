# Console financeiro — o que depende de você

Branch `feat/console-financeiro`. Tudo abaixo é coisa que **nenhum agente pode fazer**: exige
credencial, painel externo, banco de verdade, navegador, ou uma decisão sua.

Ordenado por consequência de esquecer, não por esforço.

---

## 1. Ligar o tópico `payments` no painel do Mercado Pago

**Sem isto, metade da branch é enfeite.** O webhook que grava os pagamentos só recebe
notificação se o tópico `payments` estiver habilitado na aplicação do MP. Hoje a aplicação
está inscrita em `preapproval` (assinaturas), que é outro evento.

Se subir sem isso: a tabela `payments` fica vazia, o Caixa mostra zero, a fila fiscal fica
vazia, e a estimativa de DAS calcula sobre nada. Nada quebra — é pior, fica plausível.

**Como conferir depois de ligar:** a reconciliação (item 5) mostra a diferença entre o MP e o
banco. Se o webhook estiver funcionando, ela volta sem faltantes.

## 2. Rodar a migration no Neon **antes** de mergear

A branch cria a tabela `payments` (`drizzle/0006`). O fluxo do projeto é rodar a migration no
Neon **antes** do merge na `main`, porque o merge publica produção sozinho — se o código subir
antes da tabela existir, o console financeiro quebra na primeira visita.

`payments.tenant_id` é `SET NULL`, nunca cascade, de propósito: registro fiscal precisa
sobreviver à exclusão da loja.

## 3. Rodar a verificação de fuso contra um Postgres de verdade

Três coisas foram consertadas sem nunca terem sido observadas num banco. O script sobe um
Postgres descartável, aplica as migrations, e responde as três em sequência:

```
bash scripts/verificar-fuso.sh
```

(precisa do OrbStack rodando; derruba o container sozinho no fim e não encosta no seu banco)

O que ele verifica:

1. `paid_at` nasce como `timestamp with time zone`;
2. o offset é honrado na escrita — 22:00 de 31/08 em SP tem que virar 01:00 de 01/09 em UTC;
3. **o texto que o driver entrega vem com offset.**

A terceira é a que importa mais e é a que ninguém conseguiu observar. O drizzle em
`mode: "string"` remonta a data usando o offset **da máquina** — o que acerta por coincidência
num host UTC como a Vercel e erra por 3 horas num Mac em horário de Brasília. Foi corrigido com
um parser identidade para o OID 1184 (`lib/db/date-parsers.ts`), mas a saída contra um Postgres
real nunca foi vista.

Se a 3 falhar, a competência desliza conforme a máquina e o sintoma aparece só em dev.

## 4. Abrir o console no navegador — nenhuma tela desta branch foi vista

Quatro componentes novos (`CaixaCard`, `RecorrenciaCard`, `FilaFiscal`, `ImpostoCard`,
`ReconciliarButton`) foram provados em HTML renderizado — conteúdo, ordem, plural, e a ausência
do valor de imposto no estado escondido. **Nada foi aberto num browser.** Contraste, quebra de
linha e proporção não foram vistos por ninguém.

O console **404 em `localhost:3000` por desenho** — o fence de host exige o subdomínio. Use
`console.localhost:3000`. Preview da Vercel não serve: `*.vercel.app` dá 404 em página com
tenant, porque a resolução é por `Host`.

Precedente: a UI de venda do PR #47 subiu para produção sem nunca ter sido aberta.

## 5. Rodar o `dry` da reconciliação num mês já fechado

**É o teste que decide se a correção de fuso funcionou, e custa zero escrita.**

A reconciliação tem duas etapas: o `dry` mostra a diferença, e só a confirmação grava. Rode o
`dry` num mês que o webhook já cobriu:

- volta **sem faltantes** → o par MP × Postgres está alinhado;
- volta com **faltantes cheio** num mês que o webhook cobriu → é fuso na coluna, e o item 3
  não pegou.

Duas suposições sobre o Mercado Pago continuam sem verificação, e este `dry` resolve as duas:
que o `end_date` da busca é inclusivo, e que cobrança recorrente devolve `external_reference`.
**Se o `external_reference` não vier, todo pagamento de assinatura cai em "ignorados" e a
funcionalidade é no-op** — é o item de maior valor por um único clique.

## 6. Cadastrar duas variáveis na Vercel

- `FINANCE_ANEXO` — `III` ou `V`. Default é `III`. Decide a tabela do Simples usada no cálculo.
- `FINANCE_TAX_VALIDATED` — `false` até o contador validar. Enquanto estiver `false`, o
  `super_admin` vê os insumos (RBT12, anexo, mês de operação) mas **não** vê o DAS nem a
  alíquota; o `contador` vê tudo, marcado como não validado.

Foi a decisão que você tomou: não mostrar valor de imposto até alguém que entende validar.

---

## Para o contador

**Não precisa mais conferir a tabela de faixas.** Os 48 números dos Anexos III e V foram
conferidos contra fonte primária (LC 123/2006 no Planalto e os PDFs da Resolução CGSN 140/2018
na Receita) e conferem dígito a dígito. A fórmula da alíquota efetiva, o fator R e o teto também.

**O que precisa dele, e é a pergunta que muda o número:**

### Competência ou caixa?

O console monta o faturamento a partir dos pagamentos **recebidos** — regime de **caixa**. O
Simples Nacional é por **competência** por padrão; caixa exige opção formal. Se a Synqo não fez
essa opção, o número do console vai **divergir do PGDAS-D**, e a divergência é estrutural, não
um bug.

Isso não bloqueia o lançamento — bloqueia confiar no número para apurar.

### Validar o cálculo do DAS

Depois disso, ligar `FINANCE_TAX_VALIDATED=true` e o valor passa a aparecer para você também.

---

## Decisões suas, sem prazo imediato

### Trilha de auditoria do carimbo de NFS-e

Hoje o contador registra o número da nota e um `super_admin` pode desfazer. Mas o desfazer
**apaga `nfse_issued_by`** — depois dele não sobra registro de que houve carimbo nem de quem
carimbou. Para o cenário que motivou a correção (credencial abusada carimbando em massa) essa é
exatamente a propriedade errada: o undo come a evidência.

O conserto é uma tabela append-only de log — tabela nova e migration, por isso não foi feito
junto. **Vale resolver antes de 01/11/2026**, quando o Emissor Nacional vira obrigatório para
ME/EPP do Simples e esse fluxo passa a rodar toda competência.

### Reconferir a tabela do Simples em 1º/1/2027

A LC 214/2025 (art. 519) substitui os Anexos. Faixas 1 a 5 e parcelas a deduzir não mudam; a
**alíquota nominal da 6ª faixa** muda em 2027–2028 (Anexo III 33,00% → 32,90%, Anexo V 30,50% →
30,40%) e volta ao atual em 2029.

Efeito prático hoje: nenhum. A 6ª faixa começa em RBT12 de R$ 3,6 milhões. Está anotado no
próprio arquivo (`lib/simples-tabela.ts`) para quem for reconferir.

### Armadilha registrada para quem for reconferir a lei

O `planalto.gov.br` **não estava fora do ar** — ele derruba a conexão de cliente HTTP que não se
identifica como navegador. Com `curl -A "<user-agent de navegador>"` abre normal. Uma tentativa
anterior concluiu, erradamente, que o texto legal era inalcançável, e a tabela ficou meses
apoiada só em fonte secundária por causa disso.

---

## Pendências antigas que esta branch não tocou

- `/superadmin/cupons/novo` não tem seletor de parceiro — o modelo "parceiro dá cupom" não é
  operável pela interface.
- UI de anexos de contas a pagar (rota GET + upload nos formulários) foi adiada de propósito.
- Rotação de credenciais — adiada por decisão sua.
- `lib/schema.ts:366` tem um comentário descrevendo o status de estorno como `chargeback`,
  quando a grafia real do Mercado Pago é `charged_back`. Hoje é inerte, mas descreve errado o
  dado que existe.
