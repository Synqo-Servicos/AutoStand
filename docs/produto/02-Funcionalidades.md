# Funcionalidades — AutoStand

> Referência completa de tudo que o produto faz, em linguagem de produto.
> Base para o **Manual do Usuário**. Organizado por superfície: Painel da Loja,
> Console da Plataforma, Site Público da Loja, Marketplace e Cadastro/Assinatura.
> Pré-requisito: [`01-Fundamentos.md`](01-Fundamentos.md).

**Legenda de disponibilidade por plano:**
🟢 Todos os planos · 🔵 Pro e Premium · 🟣 Apenas Premium

---

# Parte A — Painel da Loja (`/admin`)

Área logada do lojista. Acesso por `/admin/login` (e-mail e senha). Após o login, o gestor
cai no Dashboard. A navegação lateral dá acesso a todas as áreas abaixo.

## A.1 Dashboard — visão geral da loja 🟢
**Rota:** `/admin/dashboard`

Tela de abertura com a saúde do negócio no mês corrente.

- **4 indicadores principais:** vendas do mês (unidades), receita do mês, lucro bruto do mês (receita − custo dos vendidos) e valor total do estoque (custo dos carros disponíveis).
- **Composição do estoque:** distribuição visual dos veículos por status (disponível, reservado, vendido).
- **Histórico mensal:** evolução de vendas e resultado mês a mês.

Tudo é calculado em tempo real a partir das transações e do status dos veículos.

## A.2 Veículos — o estoque 🟢
**Rotas:** lista `/admin/veiculos` · novo `/admin/veiculos/novo` · edição `/admin/veiculos/[id]`

O coração operacional. Cadastro completo de cada carro, com fotos, custos e documentos.

### Lista de veículos
Tabela (desktop) ou cards (mobile) com: foto principal, marca/modelo, cor/portas,
ano/quilometragem, preço de custo, preço de venda, **margem** (venda − custo) e status.
Contador total e botão **+ Novo veículo**.

### Cadastro / edição de veículo
Campos do formulário:

- **Identificação:** marca (lista comum ou digitação livre), modelo, versão (ex.: "1.5 Turbo GT"), ano/modelo, ano/fabricação.
- **Uso e preços:** quilometragem, preço de custo, preço de venda.
- **Ficha técnica:** câmbio (automático/manual), combustível (flex, gasolina, etanol, diesel, elétrico, híbrido), cor, nº de portas, carroceria (hatch, sedã, SUV, picape, minivan, cupê, conversível, perua), condição (novo, seminovo, usado).
- **Destaques:** blindado, único dono, código FIPE, placa (normalizada para o padrão Mercosul), opcionais (lista), descrição livre.
- **Status:** disponível, reservado ou vendido.

Marca e modelo são obrigatórios; preços devem ser positivos.

### Subseções na edição do veículo
1. **Fotos** — upload de múltiplas imagens, definição da foto principal (a que aparece na vitrine) e galeria/lightbox para visualizar.
2. **Despesas diretas** — custos atrelados ao carro (polimento, reparo, documentação, laudo, etc.). O sistema recalcula a **margem real** = venda − custo − despesas diretas, com o percentual. Disponível para carros disponíveis ou vendidos.
3. **Documentos do veículo** — upload por categoria (CRLV, laudo, DUT, NF, OS, contrato, histórico, outros), com download e exclusão.
4. **Post para Instagram** 🔵 — gera uma imagem 1080×1080 com os dados do veículo e uma **legenda automática por IA**; permite baixar a imagem e copiar a legenda. Requer foto principal.

## A.3 Leads — o CRM de vendas 🟢
**Rota:** `/admin/leads`

Acompanha cada contato gerado pelo site e pelo marketplace, em um funil com integração ao WhatsApp.

- **Funil em 5 estágios:** Novo → Contatado → Em negociação → Convertido / Perdido.
- **Métricas:** total de leads, em aberto, convertidos, taxa de conversão e alerta de leads "novos" há mais de 2 dias sem contato.
- **Dados por lead:** nome, telefone, e-mail, veículo de interesse, **origem** (site, marketplace, WhatsApp, manual) e data.
- **Ações:** mudar de estágio, **enviar mensagem por WhatsApp** com 3 modelos prontos (saudação, follow-up, agendamento de test-drive) e excluir. O envio da 1ª mensagem marca o lead como "contatado" automaticamente.
- **Visual:** Kanban de 5 colunas no desktop; seletor de estágio no mobile.

Telefones são normalizados para o padrão do WhatsApp (DDI 55) automaticamente.

## A.4 Transações — entradas, saídas e despesas 🟢
**Rota:** `/admin/transacoes`

Registro detalhado de movimentações. Tipos: **entrada** (compra), **saída** (venda),
**custo direto do veículo**, **despesa fixa**, **despesa variável** e **comissão**.

Cada transação tem data, tipo (com cor), veículo relacionado, valor, comprador e
observações. Inclui um **resumo mensal** agregado. Nova transação é cadastrada por um
painel lateral (slide-over).

## A.5 Financeiro — o resultado da loja 🟢
**Rota:** `/admin/financeiro`

Relatório consolidado com seletor de mês/ano e **exportação para CSV**. Três abas:

- **Resumo** — receita, veículos vendidos, despesas totais e lucro líquido com margem %. Inclui a demonstração de resultado: receita − custo dos vendidos = lucro bruto; menos despesas diretas e operacionais = lucro líquido.
- **Por veículo** — margem real de cada carro vendido no período (receita, custo, despesas, margem e %).
- **Despesas operacionais** — gestão das despesas de estrutura, pessoal, operação e impostos (adicionar, editar, excluir, categorizar). Categorias-padrão já vêm sugeridas (aluguel, energia, salários, marketing, DAS, etc.).

**Como o resultado é calculado:**
```
Margem bruta (carro)   = venda − custo
Margem real (carro)    = venda − custo − despesas diretas
Lucro líquido (mês)    = receita − custos − despesas diretas − despesas operacionais
Margem %               = lucro líquido ÷ receita × 100
```

## A.6 Vendedores — equipe e comissões 🟢
**Rota:** `/admin/vendedores`

Cadastro da equipe de vendas com regra de comissão por vendedor (valor fixo ou
percentual) e status (ativo/desligado). A comissão se aplica às vendas registradas nas
transações. Excluir um vendedor preserva o histórico.

## A.7 Documentos — contratos e recibos 🟢
**Rotas:** `/admin/documentos` · gerador `/admin/documentos/[id]`

Biblioteca de modelos (contrato de venda, recibo, termo de responsabilidade, autorização
de transferência, relatório de vistoria, entre outros) que geram **PDFs preenchidos
automaticamente** com os dados do veículo selecionado e campos complementares (comprador,
datas). Resultado pronto para baixar/imprimir.

## A.8 Personalizar — a cara do site da loja 🟢/🔵
**Rota:** `/admin/personalizar`

Editor da aparência do site público, com profundidade conforme o plano:

- **Cores da marca** 🟢 — cor primária, de destaque e destaque escura, além do logo (com seletor visual).
- **Layout** 🔵 — estilo do hero (degradê, cor sólida ou imagem de fundo), título e subtítulo do hero; estilo dos cards de veículo (elevado, com borda, minimalista, compacto ou sobre a foto) e número de colunas (1–4), com pré-visualização ao vivo.
- **Informações da loja** 🟢 — nome, slogan, endereço, cidade, horário, e-mail, WhatsApp, redes sociais (Instagram, Facebook, YouTube, TikTok, Twitter/X) e bancos parceiros de financiamento a exibir.
- **Seção "Sobre"** 🟢 — itens "Por que escolher [loja]" com ícone, título e descrição, reordenáveis.
- **CTA de contato** 🟢 — título e texto da chamada final do site.

## A.9 Marketplace — participação na vitrine central 🟢
**Rota:** `/admin/marketplace`

Liga/desliga a presença da loja no marketplace AutoStand e mostra a URL pública do perfil
(`autostand.com.br/loja/{slug}`). Explica os benefícios: mais alcance, leads que caem no
CRM da loja e o site próprio preservado. Adesão opcional, reversível a qualquer momento.

## A.10 Análise de IA — auditoria da vitrine 🟣
**Rota:** `/admin/analise`

Botão "Analisar vitrine" que dispara uma análise por IA da loja (marca, layout, catálogo,
conteúdo) e devolve **recomendações priorizadas** por severidade (alta/média/baixa) e área.
Bloqueado fora do Premium, com chamada para upgrade.

## A.11 Inteligência de demanda — o que o mercado procura 🟣
**Rota:** `/admin/inteligencia`

Mostra o que compradores estão buscando — tanto no marketplace (agregado da rede) quanto
no site da própria loja — em um período. Um botão "Gerar dicas" usa IA para transformar
esses sinais em **sugestões de estoque e anúncio** (ex.: "alta procura por hatch preto até
R$ 40 mil"). Bloqueado fora do Premium.

## A.12 Assinatura — plano e pagamento 🟢
**Rota:** `/admin/assinatura`

Mostra o plano atual, preço, status da loja (no ar/pendente) e a lista de recursos
incluídos vs. bloqueados (com cadeado e link de upgrade). Se já houver assinatura ativa,
oferece "Gerenciar pagamento" (Mercado Pago); se pendente, orienta sobre a confirmação do
1º pagamento.

---

# Parte B — Console da Plataforma (`/superadmin`)

Área do operador AutoStand. Acesso por `/superadmin/login` (perfil super-admin).

## B.1 Dashboard da plataforma
**Rota:** `/superadmin/dashboard`

Visão global: total de concessionárias, ativas, suspensas, veículos na plataforma e leads
na plataforma. Lista as concessionárias mais recentes (nome, domínio, nº de veículos,
status) e oferece o atalho "Nova concessionária".

## B.2 Concessionárias (tenants)
**Rotas:** lista `/superadmin/tenants` · nova `/superadmin/tenants/novo` · edição `/superadmin/tenants/[id]`

CRUD das lojas clientes. A lista traz nome+slug, domínio, estoque, leads e status.
O cadastro define: nome, slug (auto a partir do nome), domínio customizado, plano, cores,
logo, hero, cidade, WhatsApp, Instagram, horário e e-mail. Há uma seção para criar o
**administrador da loja** (nome, e-mail, senha) já no ato. A edição permite atualizar tudo
e excluir a loja (remoção em cascata).

## B.3 Parceiros — canal de indicação
**Rotas:** lista `/superadmin/parceiros` · novo `/superadmin/parceiros/novo` · edição `/superadmin/parceiros/[id]`

Cadastro de parceiros indicadores. Cada um tem nome, **código de indicação** (gerado do
nome), tipo e valor de desconto/comissão (percentual ou fixo), limite de usos, validade e
status. O sistema monta o **link de indicação** (`autostand.com.br/assinar?parceiro=CÓDIGO`)
pronto para copiar, e mostra quantas indicações já foram usadas.

## B.4 Cupons — descontos de assinatura
**Rotas:** lista `/superadmin/cupons` · novo `/superadmin/cupons/novo`

Códigos promocionais aplicados na assinatura das lojas. Cada cupom tem código (maiúsculas,
sem espaço), descrição interna, **tipo de desconto** (percentual, valor fixo ou 1º mês
grátis), valor, número máximo de usos e validade. A lista mostra desconto, usos e status
(disponível/esgotado).

---

# Parte C — Site Público da Loja (storefront)

Servido no domínio/subdomínio do tenant. **Whitelabel** (marca da loja). Renderiza apenas
quando a loja está ativa; caso contrário, mostra "loja indisponível".

## C.1 Vitrine (home da loja)
**Rota:** `/` (no host da loja)

- **Hero** — título, subtítulo e slogan editáveis; fundo em degradê, cor sólida ou imagem 🔵; CTAs "Ver estoque" e "Falar no WhatsApp"; provas sociais.
- **Estoque** — grade de veículos disponíveis com **filtros** (busca por marca/modelo, marca, ano mín./máx., quilometragem, combustível, câmbio, faixa de preço) e cards no estilo escolhido pela loja. Cada card leva ao detalhe ou direto ao WhatsApp.
- **Sobre** — cards de diferenciais da loja.
- **Contato** — endereço, horário, WhatsApp e redes sociais.
- **Navbar** fixa, **footer** com redes sociais e **botão flutuante de WhatsApp**.

## C.2 Página do veículo
**Rota:** `/veiculos/[id]`

Galeria de fotos com lightbox, ficha técnica completa, destaques (único dono, blindado,
opcionais), descrição, **formulário "Tenho interesse"** (nome, telefone, e-mail, mensagem),
botão de WhatsApp pré-preenchido e logos dos **bancos parceiros**. O envio do formulário
cria um lead atribuído à loja, com origem "site". Protegido contra spam (limite por IP e
verificação anti-robô).

---

# Parte D — Marketplace Agregado

Vitrine central pública no host da plataforma, reunindo o estoque das lojas que ativaram a
participação. **Veste a marca AutoStand.**

## D.1 Home do marketplace
**Rota:** `/` (no host da plataforma)

Hero com busca rápida, provas sociais (nº de veículos, lojas e cidades), mosaico de fotos,
seção "em destaque" com veículos, vitrine das lojas da rede e chamada para o lojista
("Anuncie sua loja").

## D.2 Busca de veículos
**Rota:** `/comprar`

Resultado central com **filtros avançados** (busca, marca, cidade, combustível, câmbio,
carroceria, preço até, ano a partir de), **ordenação** (mais recentes, menor/maior preço,
menor quilometragem), grade paginada (24 por página) e cards que exibem **a loja de origem**
(logo, nome, cidade).

## D.3 Detalhe no marketplace
**Rota:** `/comprar/[id]`

Galeria, ficha técnica, destaques e descrição; coluna fixa com preço, identificação da
**loja** (link para o site dela), botão de WhatsApp e **formulário de interesse** com
verificação anti-robô. O lead vai direto para a loja dona do veículo, com origem
"marketplace".

## D.4 Lojas da rede
**Rota:** `/lojas`

Diretório das concessionárias participantes (logo, nome, cidade e nº de veículos), cada uma
linkando para o seu site.

---

# Parte E — Aquisição e Assinatura (para o lojista-prospecto)

## E.1 Landing institucional
**Rota:** `/anuncie`

Página que vende o AutoStand para o lojista: pitch ("Venda mais. Improvise menos."), os três
pilares (Controle, Clareza, Parceria), a seção de planos e chamadas para assinar. Aceita
`?parceiro=CÓDIGO` para indicações.

## E.2 Cadastro / assinatura
**Rota:** `/assinar`

Formulário self-service: seleção de plano, dados da loja (nome e endereço/slug com validação
ao vivo de disponibilidade), dados de acesso do admin (nome, e-mail, senha), **campo de
cupom** com validação e prévia do desconto, e verificação anti-robô. Ao enviar, cria a loja
(status "incompleta") e o admin, e encaminha ao **checkout do Mercado Pago**.

## E.3 Sucesso
**Rota:** `/assinar/sucesso`

Confirma o cadastro e explica que o site entra no ar após a confirmação do primeiro
pagamento.

---

## Apêndice — Mapa de rotas

### Host da plataforma (`autostand.com.br`)
| Rota | Função |
|---|---|
| `/` | Home do marketplace |
| `/comprar` · `/comprar/[id]` | Busca e detalhe de veículos |
| `/lojas` | Diretório de concessionárias |
| `/loja/[slug]` | Perfil público de uma loja |
| `/anuncie` | Landing para lojistas |
| `/assinar` · `/assinar/sucesso` | Cadastro e confirmação |

### Painel da Loja (`/admin`)
`dashboard` · `veiculos` (+ `novo`, `[id]`) · `leads` · `transacoes` · `financeiro` ·
`vendedores` · `documentos` (+ `[id]`) · `personalizar` · `marketplace` · `analise` 🟣 ·
`inteligencia` 🟣 · `assinatura` · `login`

### Console da Plataforma (`/superadmin`)
`dashboard` · `tenants` (+ `novo`, `[id]`) · `parceiros` (+ `novo`, `[id]`) ·
`cupons` (+ `novo`) · `login`

### Site da loja (host do tenant)
`/` (vitrine) · `/veiculos/[id]` (detalhe)
