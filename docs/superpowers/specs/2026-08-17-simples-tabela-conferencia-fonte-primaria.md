# Verificação da tabela do Simples Nacional (Anexos III e V) contra a fonte primária

> **DOCUMENTO HISTÓRICO — registro de uma verificação, não descrição do código atual.**
>
> Ele descreve `lib/simples-tabela.ts` **como o arquivo estava em 17/08/2026, antes
> das correções que esta própria verificação motivou**. As duas divergências que a
> seção 6.3 aponta **já foram corrigidas** (commit `9a14982`), e a ressalva de
> "fontes secundárias" que a seção 1 cita **já foi substituída** pela procedência
> primária. As âncoras de linha citadas ao longo do texto são as de antes das
> correções e não valem mais.
>
> **O que continua válido, e é a razão de guardar isto:** os 48 números conferem
> dígito a dígito com a fonte primária, e o calendário de reconferência é
> **1º/1/2027**, não 2029. Para o estado atual, leia o cabeçalho do próprio
> `lib/simples-tabela.ts`.

**Data da verificação:** 17/08/2026
**Arquivo verificado:** `/Users/ulpio/Projects/Synqo/AutoStand/lib/simples-tabela.ts`
**Veredito:** os 48 números da tabela (2 anexos × 6 faixas × 4 valores) **CONFEREM** com a fonte primária, dígito a dígito. A fórmula e a regra do fator R também conferem. Há **uma divergência factual no comentário** do arquivo (não nos números) sobre a data em que a tabela precisa ser reconferida.

---

## 0. Acesso à fonte primária — resolvido

O `planalto.gov.br` **abriu desta vez**. O que mudou:

| Via | Resultado |
|---|---|
| WebFetch (`https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm`) | `ECONNRESET` (falhou de novo, 3 tentativas, http e https, capitalizações diferentes) |
| `curl -sSL` com User-Agent de navegador | **HTTP 200, 1.620.693 bytes** — texto consolidado completo |

Ou seja: a recusa não é bloqueio de rede da máquina, é o Planalto derrubando a conexão do cliente HTTP padrão. Com `-A "Mozilla/5.0 ..."` o texto sai inteiro.

**Consequência para o arquivo:** o comentário atual de `lib/simples-tabela.ts` (linhas 14-21) diz que os números vieram de três reproduções secundárias porque o Planalto não abria. Isso agora está **desatualizado** — os mesmos números foram confirmados na fonte primária e na regulamentação oficial da Receita. O nível de confiança sobe de "três secundárias concordantes" para **primária confirmada**.

### Fontes efetivamente lidas

| # | Fonte | URL | Natureza | Status |
|---|---|---|---|---|
| F1 | LC 123/2006 consolidada — Anexos III e V, redação da LC 155/2016, vigência 01/01/2018 | `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm` | **Primária** (lei) | Lida via curl, HTTP 200 |
| F2 | Resolução CGSN 140/2018 — ANEXO III (PDF oficial) | `https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=48432` | **Oficial** (regulamento RFB) | PDF 34.839 B, texto extraído |
| F3 | Resolução CGSN 140/2018 — ANEXO V (PDF oficial) | `http://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=48446` | **Oficial** (regulamento RFB) | PDF 8.027 B, texto extraído |
| F4 | Anexo V da Res. CGSN 94/2011 (vigência 01/01/2018) — versão anterior, usada como 3ª conferência | `http://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=45092` | **Oficial** | PDF 43.611 B, texto extraído |
| F5 | LC 214/2025 (reforma tributária) — art. 519 e Anexos XVIII a XXIII | `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm` | **Primária** (lei) | Lida via curl, HTTP 200, 5.399.944 B |
| F6 | Receita Federal — notícia oficial sobre Res. CGSN 190/2026 e 191/2026 | `https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/cgsn-atualiza-regras-do-simples-nacional-para-adequacao-a-reforma-tributaria-do-consumo` | **Oficial** (RFB) | Lida |

Nenhuma fonte secundária foi usada para estabelecer valor. As secundárias que apareceram na busca serviram só para localizar as URLs oficiais.

---

## 1. ANEXO III — fonte primária

> **Fonte:** F1 — `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm`
> Cabeçalho literal: *"ANEXO III DA LEI COMPLEMENTAR Nº 123, DE 14 DE DEZEMBRO DE 2006 — (Redação dada pela Lei Complementar nº 155, de 2016) — (Vigência: 01/01/2018) — Alíquotas e Partilha do Simples Nacional - Receitas de locação de bens móveis e de prestação de serviços não relacionados no § 5º-C do art. 18 desta Lei Complementar"*
> **Corroborado por:** F2 (PDF da Res. CGSN 140/2018), idêntico dígito a dígito.

| Faixa | RBT12 — limite inferior | RBT12 — limite superior | Alíquota nominal | Parcela a deduzir (PD) |
|---|---|---|---|---|
| 1ª | R$ 0,00 | R$ 180.000,00 | 6,00% | — (zero) |
| 2ª | R$ 180.000,01 | R$ 360.000,00 | 11,20% | R$ 9.360,00 |
| 3ª | R$ 360.000,01 | R$ 720.000,00 | 13,50% | R$ 17.640,00 |
| 4ª | R$ 720.000,01 | R$ 1.800.000,00 | 16,00% | R$ 35.640,00 |
| 5ª | R$ 1.800.000,01 | R$ 3.600.000,00 | 21,00% | R$ 125.640,00 |
| 6ª | R$ 3.600.000,01 | R$ 4.800.000,00 | 33,00% | R$ 648.000,00 |

### Comparação contra `lib/simples-tabela.ts` (linhas 94-101)

| Faixa | Campo | Repo | Fonte | Resultado |
|---|---|---|---|---|
| 1 | `ateCents` | 180_000_00 → R$ 180.000,00 | R$ 180.000,00 | **confere** |
| 1 | `nominal` | 600 → 6,00% | 6,00% | **confere** |
| 1 | `deduzirCents` | 0 → R$ 0,00 | — | **confere** |
| 2 | `ateCents` | 360_000_00 → R$ 360.000,00 | R$ 360.000,00 | **confere** |
| 2 | `nominal` | 1120 → 11,20% | 11,20% | **confere** |
| 2 | `deduzirCents` | 9_360_00 → R$ 9.360,00 | R$ 9.360,00 | **confere** |
| 3 | `ateCents` | 720_000_00 → R$ 720.000,00 | R$ 720.000,00 | **confere** |
| 3 | `nominal` | 1350 → 13,50% | 13,50% | **confere** |
| 3 | `deduzirCents` | 17_640_00 → R$ 17.640,00 | R$ 17.640,00 | **confere** |
| 4 | `ateCents` | 1_800_000_00 → R$ 1.800.000,00 | R$ 1.800.000,00 | **confere** |
| 4 | `nominal` | 1600 → 16,00% | 16,00% | **confere** |
| 4 | `deduzirCents` | 35_640_00 → R$ 35.640,00 | R$ 35.640,00 | **confere** |
| 5 | `ateCents` | 3_600_000_00 → R$ 3.600.000,00 | R$ 3.600.000,00 | **confere** |
| 5 | `nominal` | 2100 → 21,00% | 21,00% | **confere** |
| 5 | `deduzirCents` | 125_640_00 → R$ 125.640,00 | R$ 125.640,00 | **confere** |
| 6 | `ateCents` | 4_800_000_00 → R$ 4.800.000,00 | R$ 4.800.000,00 | **confere** |
| 6 | `nominal` | 3300 → 33,00% | 33,00% | **confere** |
| 6 | `deduzirCents` | 648_000_00 → R$ 648.000,00 | R$ 648.000,00 | **confere** |

**Limites inferiores:** o repo não os armazena — modela só o teto (`ateCents`, inclusive) e infere o piso como `teto_anterior + 1 centavo`. Isso reproduz exatamente a redação legal ("Até 180.000,00" / "De 180.000,01 a 360.000,00"). **Confere** por construção.

**Nível de confiança: ALTO — fonte primária (lei) + regulamento oficial da RFB, concordantes.**

---

## 2. ANEXO V — fonte primária

> **Fonte:** F1 — `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm`
> Cabeçalho literal: *"ANEXO V DA LEI COMPLEMENTAR Nº 123, DE 14 DE DEZEMBRO DE 2006. — (Redação dada pela Lei Complementar nº 155, de 2016) — (Vigência: 01/01/2018) — Alíquotas e Partilha do Simples Nacional — Receitas decorrentes da prestação de serviços relacionados no § 5º-I do art. 18 desta Lei Complementar"*
> **Corroborado por:** F3 (PDF da Res. CGSN 140/2018) e F4 (PDF do Anexo V da Res. CGSN 94/2011, vigência 01/01/2018) — os três idênticos.

| Faixa | RBT12 — limite inferior | RBT12 — limite superior | Alíquota nominal | Parcela a deduzir (PD) |
|---|---|---|---|---|
| 1ª | R$ 0,00 | R$ 180.000,00 | 15,50% | — (zero) |
| 2ª | R$ 180.000,01 | R$ 360.000,00 | 18,00% | R$ 4.500,00 |
| 3ª | R$ 360.000,01 | R$ 720.000,00 | 19,50% | R$ 9.900,00 |
| 4ª | R$ 720.000,01 | R$ 1.800.000,00 | 20,50% | R$ 17.100,00 |
| 5ª | R$ 1.800.000,01 | R$ 3.600.000,00 | 23,00% | R$ 62.100,00 |
| 6ª | R$ 3.600.000,01 | R$ 4.800.000,00 | 30,50% | R$ 540.000,00 |

### Comparação contra `lib/simples-tabela.ts` (linhas 107-114)

| Faixa | Campo | Repo | Fonte | Resultado |
|---|---|---|---|---|
| 1 | `ateCents` | 180_000_00 → R$ 180.000,00 | R$ 180.000,00 | **confere** |
| 1 | `nominal` | 1550 → 15,50% | 15,50% | **confere** |
| 1 | `deduzirCents` | 0 → R$ 0,00 | — | **confere** |
| 2 | `ateCents` | 360_000_00 → R$ 360.000,00 | R$ 360.000,00 | **confere** |
| 2 | `nominal` | 1800 → 18,00% | 18,00% | **confere** |
| 2 | `deduzirCents` | 4_500_00 → R$ 4.500,00 | R$ 4.500,00 | **confere** |
| 3 | `ateCents` | 720_000_00 → R$ 720.000,00 | R$ 720.000,00 | **confere** |
| 3 | `nominal` | 1950 → 19,50% | 19,50% | **confere** |
| 3 | `deduzirCents` | 9_900_00 → R$ 9.900,00 | R$ 9.900,00 | **confere** |
| 4 | `ateCents` | 1_800_000_00 → R$ 1.800.000,00 | R$ 1.800.000,00 | **confere** |
| 4 | `nominal` | 2050 → 20,50% | 20,50% | **confere** |
| 4 | `deduzirCents` | 17_100_00 → R$ 17.100,00 | R$ 17.100,00 | **confere** |
| 5 | `ateCents` | 3_600_000_00 → R$ 3.600.000,00 | R$ 3.600.000,00 | **confere** |
| 5 | `nominal` | 2300 → 23,00% | 23,00% | **confere** |
| 5 | `deduzirCents` | 62_100_00 → R$ 62.100,00 | R$ 62.100,00 | **confere** |
| 6 | `ateCents` | 4_800_000_00 → R$ 4.800.000,00 | R$ 4.800.000,00 | **confere** |
| 6 | `nominal` | 3050 → 30,50% | 30,50% | **confere** |
| 6 | `deduzirCents` | 540_000_00 → R$ 540.000,00 | R$ 540.000,00 | **confere** |

**Nível de confiança: ALTO — fonte primária (lei) + dois regulamentos oficiais da RFB, concordantes.**

---

## 3. Fórmula da alíquota efetiva — **confere**

> **Fonte:** F1, LC 123/2006, **art. 18, § 1º-A** (incluído pela LC 155/2016):
> *"§ 1º-A. A alíquota efetiva é o resultado de: `(RBT12 x Aliq - PD) / RBT12`, em que:*
> *I - RBT12: receita bruta acumulada nos doze meses anteriores ao período de apuração;*
> *II - Aliq: alíquota nominal constante dos Anexos I a V desta Lei Complementar;*
> *III - PD: parcela a deduzir constante dos Anexos I a V desta Lei Complementar."*

A fórmula do módulo, `(RBT12 × Aliq − PD) / RBT12`, é **idêntica à da lei**. **Confere.**

Observação: o comentário do repo (linhas 20-21) atribui a fórmula ao *art. 21, inciso II da Resolução CGSN 140/2018*. Está correto — a resolução reproduz a fórmula —, mas a norma de hierarquia superior é o art. 18 § 1º-A da própria LC 123/2006. Vale citar a lei, que é mais estável que a resolução.

Complemento relevante (art. 18, § 1º): a alíquota **nominal** é determinada pela receita bruta acumulada nos **doze meses anteriores** ao período de apuração — não pelo mês corrente nem pelo ano-calendário.

### Teste numérico de continuidade (rodado sobre os valores do repo)

| Virada | Anexo III | Anexo V |
|---|---|---|
| 1ª → 2ª @ R$ 180.000,00 | 6,000000% vs 6,000000% — OK | 15,500000% vs 15,500000% — OK |
| 2ª → 3ª @ R$ 360.000,00 | 8,600000% vs 8,600000% — OK | 16,750000% vs 16,750000% — OK |
| 3ª → 4ª @ R$ 720.000,00 | 11,050000% vs 11,050000% — OK | 18,125000% vs 18,125000% — OK |
| 4ª → 5ª @ R$ 1.800.000,00 | 14,020000% vs 14,020000% — OK | 19,550000% vs 19,550000% — OK |
| 5ª → 6ª @ R$ 3.600.000,00 | 17,510000% vs 15,000000% — **descontinuidade** | 21,275000% vs 15,500000% — **descontinuidade** |

A descontinuidade da 5ª para a 6ª faixa é real e está corretamente documentada no arquivo (linhas 42-53): na 6ª faixa o ISS sai do DAS. Os valores batem exatamente com os que o comentário afirma (III: 17,51% → 15,00%; V: 21,275% → 15,50%). **Confere.**

---

## 4. Regra do fator R (28%) — **confere**

> **Fonte:** F1, LC 123/2006, art. 18:
> **§ 5º-J** (incluído pela LC 155/2016): *"As atividades de prestação de serviços a que se refere o § 5º-I serão tributadas na forma do **Anexo III** desta Lei Complementar caso a razão entre a folha de salários e a receita bruta da pessoa jurídica seja **igual ou superior a 28%** (vinte e oito por cento)."*
> **§ 5º-M**: *"Quando a relação entre a folha de salários e a receita bruta da microempresa ou da empresa de pequeno porte for **inferior a 28%**, serão tributadas na forma do **Anexo V** (...)"*
> **§ 5º-K**: *"Para o cálculo da razão a que se referem os §§ 5º-J e 5º-M, serão considerados, respectivamente, os montantes pagos e auferidos nos **doze meses anteriores** ao período de apuração (...)"*
> **§ 24** (redação da LC 155/2016): *"Para efeito de aplicação do § 5º-K, considera-se folha de salários, incluídos encargos, o montante pago, nos doze meses anteriores ao período de apuração, a título de remunerações a pessoas físicas decorrentes do trabalho, acrescido do montante efetivamente recolhido a título de contribuição patronal previdenciária e FGTS, **incluídas as retiradas de pró-labore**."*

Comparação com o comentário do repo (linhas 57-61):

| Afirmação do repo | Fonte | Resultado |
|---|---|---|
| Fator R = folha ÷ receita bruta | § 5º-J / § 5º-M | **confere** |
| ambos dos 12 meses anteriores | § 5º-K | **confere** |
| `>= 28%` → Anexo III | § 5º-J ("igual ou superior a 28%") | **confere** — inclusive o operador: 28% exatos caem no III |
| `< 28%` → Anexo V | § 5º-M ("inferior a 28%") | **confere** |
| citação "art. 18, §§ 5º-J e 5º-M" | — | **confere** |
| pró-labore entra na folha | § 24 | **confere** |

O desenho do módulo (anexo como **parâmetro** de `aliquotaEfetiva`, não constante) está certo: o § 5º-K obriga reavaliação mês a mês.

**Nível de confiança: ALTO — fonte primária.**

---

## 5. Teto do Simples (R$ 4.800.000,00) — **confere**

> **Fonte:** F1, LC 123/2006, **art. 3º, II** (redação da LC 155/2016): *"no caso de empresa de pequeno porte, aufira, em cada ano-calendário, receita bruta superior a R$ 360.000,00 (...) e igual ou inferior a **R$ 4.800.000,00** (quatro milhões e oitocentos mil reais)."*

`LIMITE_SIMPLES_CENTS` é derivado do teto da 6ª faixa do Anexo III (R$ 4.800.000,00). **Confere**, e a derivação é legítima: o teto da última faixa e o limite do art. 3º II coincidem por construção legal.

---

## 6. Alteração legislativa posterior — o que está em vigor em agosto/2026

### 6.1 Em 2026: **nada mudou**. A tabela de 2018 continua valendo.

O texto consolidado da LC 123/2006 traz, sobre os Anexos III e V, apenas a marca *"(Redação dada pela Lei Complementar nº 155, de 2016) — (Vigência: 01/01/2018)"* e um *"(Vide Lei Complementar nº 214, de 2025) Produção de efeitos"* — que é remissão, não nova redação vigente.

Leis complementares que alteraram a LC 123/2006 e aparecem no texto consolidado: 147/2014, 154/2016, 155/2016, 167/2019, 168/2019, 169/2019, 182/2021, 188/2021, **214/2025**, **216/2025**, **227/2026**. Nenhuma delas alterou faixas, alíquotas nominais ou parcelas a deduzir **com efeitos em 2026**.

### 6.2 LC 214/2025 (reforma tributária) — substitui os anexos, mas só a partir de 1º/1/2027

> **Fonte:** F5 — `https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm`
> **Art. 519:** *"Os Anexos I a V da Lei Complementar nº 123, de 14 de dezembro de 2006, passam a vigorar com a redação dos Anexos XVIII a XXII desta Lei Complementar."*

Mapeamento: Anexo III da LC 123 → **Anexo XX** da LC 214; Anexo V da LC 123 → **Anexo XXII** da LC 214. Ambos trazem, no próprio cabeçalho, a vigência:

- `(Vigência: 1º/1/2027 a 31/12/2028)` — tabela dos anos-calendário 2027 e 2028
- `(Vigência: 1º/1/2029)` — tabela a partir de 2029
- e tabelas de **repartição** separadas por ano-calendário até 2033

**Portanto: em 2026 os anexos vigentes são os da LC 155/2016 — exatamente os que estão no repo.**

### 6.3 ⚠️ Divergência encontrada (JÁ CORRIGIDA em `9a14982`) — no comentário, não nos números

O comentário do arquivo (linhas 32-36) afirma:

> *"REFORMA TRIBUTÁRIA (LC 214/2025): a transição começou em 2026 e altera a coluna de REPARTIÇÃO dos anexos (...), que este módulo não usa. **As faixas, as alíquotas nominais e as parcelas a deduzir seguem as mesmas**, e a carga total do DAS não muda na transição. **Reconferir a partir de 2029**, quando a redução gradual de ICMS/ISS começa."*

Isso está **incorreto em dois pontos**:

**(a) A alíquota nominal da 6ª faixa MUDA — e muda já em 2027, não em 2029.**

| Anexo | Faixa | Hoje (2018-2026) | LC 214, anos 2027-2028 | LC 214, a partir de 2029 |
|---|---|---|---|---|
| III (LC 214 Anexo XX) | 6ª | **33,00%** | **32,90%** | 33,00% (volta) |
| V (LC 214 Anexo XXII) | 6ª | **30,50%** | **30,40%** | 30,50% (volta) |

As faixas de RBT12, as parcelas a deduzir (R$ 648.000,00 e R$ 540.000,00) e as alíquotas das faixas 1 a 5 permanecem idênticas em todos os períodos. Só a nominal da 6ª faixa oscila 0,10 p.p. para baixo em 2027-2028.

**(b) A data de reconferência está errada.** O comentário manda reconferir "a partir de 2029". A primeira alteração vigente é em **1º/1/2027**. Se a flag ficar ligada e ninguém revisar, o módulo passa a errar a partir de janeiro/2027 — ainda que só na 6ª faixa.

**Impacto prático para a SYNQO:** nulo hoje. A 6ª faixa começa em RBT12 acima de R$ 3.600.000,00, e o próprio arquivo já registra (linhas 51-53) que isso está fora do alcance da empresa por ordens de grandeza. Além disso, na 6ª faixa o módulo já subestima o imposto por causa do ISS fora do DAS. A correção é de precisão documental e de calendário de manutenção, não de número exibido.

### 6.4 Resoluções CGSN 190/2026 e 191/2026 — também só a partir de 1º/1/2027

> **Fonte:** F6 — notícia oficial da Receita Federal (agosto/2026)

As Resoluções CGSN nº 190 e nº 191, de 2026, alteram a Resolução CGSN 140/2018 para integrar IBS e CBS ao Simples Nacional, redefinir o conceito de receita bruta e ajustar regras de MEI e de início de atividade. **Produzem efeitos, em regra, a partir de 1º/1/2027.** Não alteram alíquotas nominais, faixas de RBT12 nem parcelas a deduzir dos Anexos III e V para 2026, nem o limite de R$ 4.800.000,00, nem o percentual de 28% do fator R.

A Resolução CGSN **140/2018 segue sendo a norma regulamentar base** do regime.

### 6.5 O que muda de fato já em 2026 (contexto, sem efeito sobre este módulo)

- **Prazo de opção pelo Simples**: passa a ser até o último dia útil de **setembro** do ano anterior. Em setembro/2026 opta-se para o ano-calendário 2027.
- **Conceito de receita bruta** (art. 3º, § 1º, redação da LC 214/2025): passa a incluir "as demais receitas da atividade ou objeto principal". Marcado como "Produção de efeitos" — relevante para *qual receita* alimenta o RBT12, não para a tabela.
- **Escolha entre DAS unificado e apuração de IBS/CBS "por fora"** para transferir créditos ao cliente.

Nenhum desses altera a tabela codificada.

---

## 7. Conclusão e recomendações

**Os 48 valores da tabela conferem com a fonte primária. Nada a corrigir nos números.** A tabela pode sustentar a exibição de valores de imposto para 2026.

Ajustes sugeridos no **comentário** de `lib/simples-tabela.ts` (nenhuma alteração foi feita — tarefa somente leitura):

1. **Linhas 14-21** — atualizar a nota de procedência. O Planalto abre com `curl -A "<user-agent de navegador>"`; os números foram confirmados na LC 123/2006 consolidada e nos PDFs oficiais da Res. CGSN 140/2018 (URLs em F1-F4 acima). A ressalva de "só fontes secundárias" não vale mais.
2. **Linhas 20-21** — a fórmula pode ser ancorada na lei (LC 123/2006, art. 18, § 1º-A), acima da Resolução CGSN 140/2018 art. 21.
3. **Linhas 32-36 (importante)** — corrigir: (a) a alíquota nominal da 6ª faixa **muda em 2027-2028** (III: 33,00% → 32,90%; V: 30,50% → 30,40%, voltando em 2029); (b) a data de reconferência é **1º/1/2027**, não 2029.
4. **Linha 12** — a data "Conferidos em 17/08/2026" continua válida, agora com respaldo primário.

**Nível de confiança geral: ALTO.** Toda afirmação numérica deste relatório vem de `planalto.gov.br` (lei) ou de `normas.receita.fazenda.gov.br` / `gov.br/receitafederal` (regulamento e comunicação oficial). Nenhuma fonte secundária foi usada como base de valor.
