# Bloqueadores de Lançamento — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Fechar os 3 bloqueadores de lançamento do AutoStand — (1) conformidade legal/LGPD, (2) validação do checkout transparente já ligado, (3) proteção anti-abuso real (rate-limit + CAPTCHA) — para poder onboardar o 1º cliente pagante com segurança jurídica e operacional.

**Architecture:** App já em produção no **Vercel** (Next.js 16 App Router, região `gru1`) + **Neon** (Postgres serverless) + **S3/CloudFront** para uploads (presigned URL). Este plano adiciona páginas legais + aceite no cadastro (código), e valida/endurece checkout e anti-abuso (majoritariamente validação e config, pouco código). Deploy é **manual via `vercel --prod`** (a Vercel não está conectada ao GitHub — ver Contexto).

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4 (tokens em `app/globals.css`), Drizzle ORM 0.45 + `pg` (Neon), Mercado Pago (PreApproval/Card Brick), Cloudflare Turnstile, Upstash Redis, Vitest.

## Global Constraints

- **Infra atual = Vercel + Neon + S3.** Envs de produção ficam em **Vercel → Settings → Environment Variables** (não GitHub Environment, não task-def ECS — isso morreu na migração de 14/07). Ver `docs/superpowers/plans/2026-07-13-migracao-vercel-neon.md`.
- **Deploy é manual:** `vercel --prod`. Push na `main` NÃO deploya (Git integration desligada). `NEXT_PUBLIC_*` são inlined em build → qualquer mudança nelas exige **redeploy**.
- **Marca no rodapé:** "AutoStand · por Synqo". O footer da plataforma (`components/PlatformFooter.tsx`, `components/marketing/MarketingFooter.tsx`) **≠** o footer whitelabel do lojista (`components/public/StorefrontFooter.tsx` / `Footer.tsx`) — **não** colocar links legais/marca Synqo no storefront do tenant.
- **Design system:** usar tokens (`ink`, `signal`, `n50`→`n900`, `font-display`, `text-h1/h2/h3`, `text-body-s`) — nunca `slate-*`/`gray-*`/hex hardcoded. Kit em `components/ui/`.
- **Minutas legais não substituem advogado.** Os textos dos itens 1.x são minutas LGPD utilizáveis para lançar, com placeholders de dados da empresa e aviso visível de revisão jurídica. Não afirmar que são juridicamente definitivos.
- **Não commitar segredos.** Chaves reais do Turnstile/MP entram só na Vercel, nunca no repo (o push protection do GitHub já bloqueou uma branch por isso).

---

## Contexto: estado real de cada bloqueador (auditoria 2026-07-20)

| Blocker | Estado real | O que este plano faz |
|---|---|---|
| **#1 Legal/LGPD** | ❌ Aberto. Zero páginas de Termos/Privacidade/cookies. Coleta CPF/CNPJ (`app/api/assinar/route.ts:62`) + cartão (MP) sem aviso de tratamento. | Redigir minutas + páginas + aceite no signup + links no footer. **Único trabalho de código pesado.** |
| **#2 Checkout** | 🟡 Flag `CHECKOUT_MODE=transparent` **já ON** na Vercel. Lógica anti-duplo-débito (`findReconcilableSubscription`), idempotência (`sub-${tenant.id}`) e tradução de recusa (`translateDecline`) já existem em `lib/checkout.ts`. Falta **validação humana** de recusa→retry e do webhook. | Endurecer a UX de retry (remount do Card Brick) + roteiro de validação sandbox + validar webhook. |
| **#3 Rate-limit + CAPTCHA** | 🟡 Rate-limit **já live** (Upstash setado na Vercel, usa `x-real-ip`). Turnstile "ligado" mas com **chaves de teste (always-pass)** → não protege. | Verificar rate-limit (smoke) + **trocar Turnstile pelas chaves reais** do Cloudflare (config + redeploy). |

### ⚠️ Fora do escopo destes 3 bloqueadores, mas URGENTE (não deixar passar)

- **⏰ 21/07 (amanhã): deletar o RDS parado** ou ele religa e a cobrança (~US$22/mês) volta. Ver Task 8 de `2026-07-13-migracao-vercel-neon.md`.
- **🔒 Rotacionar credenciais** reusadas na migração (MP primeiro — mexe com dinheiro), depois Upstash/Gmail/Google AI. É P0 de segurança no `docs/Plano de Lançamento.md`.

---

## BLOCKER #1 — Conformidade legal / LGPD

Cria as páginas de Termos de Uso e Política de Privacidade, um aviso de cookies, os links no rodapé institucional e o aceite obrigatório no cadastro (com registro da data de aceite).

### Task 1: Layout e página de Termos de Uso

**Files:**
- Create: `components/legal/LegalDoc.tsx` (wrapper de leitura para documentos legais)
- Create: `app/(public)/termos/page.tsx`
- Test: nenhum (conteúdo estático; sem lógica)

**Interfaces:**
- Produces: `LegalDoc` (`{ title: string; updatedAt: string; children: ReactNode }`) — consumido pela Task 1 e Task 2.

- [ ] **Step 1: Criar o wrapper `components/legal/LegalDoc.tsx`**

```tsx
import type { ReactNode } from "react";

/** Wrapper de leitura para documentos legais (Termos, Privacidade).
 *  Largura de leitura confortável (~68ch) e hierarquia via tokens. */
export function LegalDoc({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[68ch] px-5 py-12">
      <h1 className="font-display text-h1 text-ink">{title}</h1>
      <p className="mt-2 text-body-s text-n500">Última atualização: {updatedAt}</p>
      <div className="mt-8 space-y-6 text-body text-n700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:text-ink [&_h2]:font-semibold [&_a]:text-signal [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-ink">
        {children}
      </div>
      <div className="mt-12 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-body-s text-n700">
        <strong className="text-ink">Aviso:</strong> minuta preparada para o lançamento.
        Recomenda-se revisão por advogado antes da versão definitiva.
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Criar `app/(public)/termos/page.tsx`**

Página server-component com o conteúdo. Substituir os placeholders `[RAZÃO SOCIAL]`, `[CNPJ]`, `[CIDADE/UF]`, `[email-juridico]` pelos dados reais da Synqo antes do deploy final.

O documento DEVE cobrir, nesta ordem, cada seção como um `<h2>` seguido de parágrafos/listas:

1. **Aceitação dos termos** — ao criar conta/assinar, o contratante (concessionária) aceita estes termos.
2. **Descrição do serviço** — AutoStand é plataforma SaaS whitelabel para concessionárias (site próprio, painel, marketplace, funil de leads, WhatsApp assistido). Fornecido por **[RAZÃO SOCIAL]** (Synqo), CNPJ **[CNPJ]**.
3. **Cadastro e conta** — dados verídicos; responsabilidade pela senha; 1 admin por loja no v1.
4. **Planos, pagamento e renovação** — assinatura mensal recorrente via **Mercado Pago**; valores dos planos (Básico/Pro/Premium); cobrança automática; site entra no ar após confirmação do 1º pagamento; inadimplência suspende o site.
5. **Cancelamento** — como cancelar; efeito (perde acesso ao painel e o site sai do ar); sem reembolso proporcional do mês em curso (ajustar conforme decisão comercial).
6. **Responsabilidades do contratante** — veracidade dos anúncios de veículos; conformidade com o Código de Defesa do Consumidor nas vendas; o contratante é **controlador** dos dados dos leads que capta (a AutoStand é operadora).
7. **Propriedade intelectual** — a plataforma e a marca AutoStand/Synqo pertencem à **[RAZÃO SOCIAL]**; o conteúdo do lojista permanece dele.
8. **Limitação de responsabilidade** — serviço "no estado em que se encontra"; sem garantia de vendas; indisponibilidades de terceiros (Mercado Pago, Vercel, provedores).
9. **Alterações dos termos** — podem mudar; notificação por e-mail; uso continuado = aceite.
10. **Foro e legislação** — legislação brasileira; foro de **[CIDADE/UF]**.
11. **Contato** — **[email-juridico]**.

```tsx
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = { title: "Termos de Uso — AutoStand" };

export default function TermosPage() {
  return (
    <LegalDoc title="Termos de Uso" updatedAt="20 de julho de 2026">
      {/* Cada seção abaixo como <section><h2>…</h2> …</section>, seguindo a
          lista de 11 itens especificada no plano. Preencher os placeholders
          [RAZÃO SOCIAL], [CNPJ], [CIDADE/UF], [email-juridico]. */}
      <section>
        <h2>1. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta e contratar um plano do AutoStand, você (a
          concessionária contratante) declara ter lido, compreendido e aceito
          integralmente estes Termos de Uso e a nossa{" "}
          <a href="/privacidade">Política de Privacidade</a>.
        </p>
      </section>
      {/* … seções 2 a 11 … */}
    </LegalDoc>
  );
}
```

- [ ] **Step 3: Verificar a rota**

```bash
npm run build
```
Esperado: build passa e a rota `/termos` aparece no output (rota estática). Abrir `http://localhost:3000/termos` (via `npm run dev`) e conferir a leitura.

- [ ] **Step 4: Commit**

```bash
git add components/legal/LegalDoc.tsx "app/(public)/termos/page.tsx"
git commit -m "feat(legal): página de Termos de Uso + wrapper LegalDoc"
```

---

### Task 2: Política de Privacidade (LGPD)

**Files:**
- Create: `app/(public)/privacidade/page.tsx`

**Interfaces:**
- Consumes: `LegalDoc` (Task 1).

- [ ] **Step 1: Criar `app/(public)/privacidade/page.tsx`**

Documento LGPD. DEVE cobrir, cada seção como `<h2>`:

1. **Quem somos (controlador)** — **[RAZÃO SOCIAL]** (Synqo), CNPJ **[CNPJ]**, é a controladora dos dados tratados na relação com as concessionárias contratantes. Encarregado (DPO): **[email-juridico]**.
2. **Dados que coletamos** —
   - *Cadastro da loja:* nome da concessionária, **CPF ou CNPJ**, endereço do site (slug).
   - *Do administrador:* nome, e-mail, senha (armazenada com hash bcrypt).
   - *Pagamento:* processado pelo **Mercado Pago**; **não armazenamos dados de cartão** — o cartão é tokenizado no navegador e enviado direto ao Mercado Pago.
   - *Uso:* endereço IP, logs de acesso (segurança/anti-abuso).
   - *Leads dos compradores:* nome, telefone, e-mail e mensagem enviados pelos visitantes das vitrines — a AutoStand atua como **operadora**; o **controlador** desses dados é a concessionária.
3. **Finalidades e base legal** — execução do contrato (art. 7º, V, LGPD) para prestar o serviço e cobrar; consentimento para comunicações; legítimo interesse para segurança/anti-fraude; cumprimento de obrigação legal (fiscal).
4. **Compartilhamento** — com operadores essenciais: **Mercado Pago** (pagamento), **Vercel** (hospedagem), **Neon** (banco de dados), **Amazon Web Services** (armazenamento de imagens/CDN), **Google** (recursos de IA), provedor de e-mail. Não vendemos dados.
5. **Transferência internacional** — alguns provedores (Vercel/AWS/Google) podem tratar dados fora do Brasil, com salvaguardas contratuais.
6. **Retenção** — enquanto durar a conta + prazo legal (fiscal) após o encerramento.
7. **Direitos do titular (art. 18 LGPD)** — confirmação, acesso, correção, anonimização, portabilidade, eliminação, revogação de consentimento — exercidos via **[email-juridico]**.
8. **Segurança** — TLS, hashing de senha, controle de acesso multi-tenant, tokenização de cartão.
9. **Cookies** — usamos **apenas cookies essenciais** (sessão/autenticação); não usamos cookies de rastreamento/publicidade de terceiros. Ver o aviso de cookies exibido no primeiro acesso.
10. **Alterações desta política** — notificação por e-mail/aviso no site.
11. **Contato do encarregado** — **[email-juridico]**.

```tsx
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = { title: "Política de Privacidade — AutoStand" };

export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt="20 de julho de 2026">
      {/* Seções 1 a 11 conforme especificado no plano; preencher placeholders. */}
    </LegalDoc>
  );
}
```

- [ ] **Step 2: Verificar e commitar**

```bash
npm run build
git add "app/(public)/privacidade/page.tsx"
git commit -m "feat(legal): Política de Privacidade (LGPD)"
```

---

### Task 3: Aviso de cookies

**Files:**
- Create: `components/CookieNotice.tsx`
- Modify: o layout público (o `layout.tsx` que embrulha o marketing/institucional — confirmar o caminho: provavelmente `app/(public)/layout.tsx`; se não existir, `app/layout.tsx`). Renderizar `<CookieNotice />` no fim do `<body>`.

- [ ] **Step 1: Criar `components/CookieNotice.tsx`**

Banner informativo, dispensável, persistido em `localStorage`. Como só há cookies essenciais, é **aviso**, não opt-in bloqueante.

```tsx
"use client";

import { useEffect, useState } from "react";

const KEY = "autostand.cookie-notice.v1";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-n200 bg-white p-4 shadow-lg sm:flex sm:items-center sm:gap-4">
      <p className="text-body-s text-n700">
        Usamos apenas cookies essenciais para o funcionamento da plataforma.
        Saiba mais na nossa{" "}
        <a href="/privacidade" className="text-signal underline">
          Política de Privacidade
        </a>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full shrink-0 rounded-lg bg-ink px-4 py-2 text-body-s font-semibold text-white hover:bg-ink-800 sm:mt-0 sm:w-auto"
      >
        Entendi
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Descobrir o layout público correto**

```bash
find app -maxdepth 2 -name "layout.tsx" | head
```
Renderizar `<CookieNotice />` no layout que embrulha as páginas institucionais/públicas (o mesmo que já mostra `MarketingFooter`). Importar de `@/components/CookieNotice`.

- [ ] **Step 3: Verificar e commitar**

```bash
npm run build
git add components/CookieNotice.tsx "app/(public)/layout.tsx"
git commit -m "feat(legal): aviso de cookies (essenciais)"
```

---

### Task 4: Links legais nos rodapés

**Files:**
- Modify: `components/marketing/MarketingFooter.tsx` (adicionar `Termos` e `Privacidade` ao `<nav>`)
- Modify: `components/PlatformFooter.tsx` (adicionar os mesmos links)

- [ ] **Step 1: `MarketingFooter.tsx` — acrescentar ao `<nav>` existente (após "Anuncie sua loja")**

```tsx
<Link href="/termos" className="text-n400 hover:text-white">
  Termos de Uso
</Link>
<Link href="/privacidade" className="text-n400 hover:text-white">
  Privacidade
</Link>
```

- [ ] **Step 2: `PlatformFooter.tsx` — adicionar os dois links**

Ler o arquivo primeiro e inserir os links no mesmo padrão dos itens já presentes ("Ajuda" etc.), mantendo o texto "AutoStand · por Synqo".

- [ ] **Step 3: Verificar e commitar**

```bash
npm run build
git add components/marketing/MarketingFooter.tsx components/PlatformFooter.tsx
git commit -m "feat(legal): links de Termos e Privacidade nos rodapés"
```

---

### Task 5: Aceite obrigatório no cadastro (client + server)

**Files:**
- Modify: `components/marketing/SignupForm.tsx` (checkbox obrigatório antes do botão)
- Modify: `app/api/assinar/route.ts` (rejeitar cadastro sem aceite)

**Interfaces:**
- Consumes: rotas `/termos` e `/privacidade` (Tasks 1–2).

- [ ] **Step 1: `SignupForm.tsx` — estado do aceite**

Adicionar ao componente:

```tsx
const [acceptedTerms, setAcceptedTerms] = useState(false);
```

- [ ] **Step 2: `SignupForm.tsx` — checkbox antes do `<button type="submit">`**

```tsx
<label className="flex items-start gap-2 text-body-s text-n700">
  <input
    type="checkbox"
    checked={acceptedTerms}
    onChange={(e) => setAcceptedTerms(e.target.checked)}
    className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
    required
  />
  <span>
    Li e aceito os{" "}
    <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-signal underline">
      Termos de Uso
    </a>{" "}
    e a{" "}
    <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-signal underline">
      Política de Privacidade
    </a>
    .
  </span>
</label>
```

- [ ] **Step 3: `SignupForm.tsx` — bloquear submit sem aceite**

Alterar a `disabled` do botão para incluir `|| !acceptedTerms`:

```tsx
disabled={!canSubmit || !!liveSlugError || !!liveDocError || !document || !acceptedTerms}
```

E incluir `accepted_terms: acceptedTerms` no corpo do `fetch("/api/assinar", …)`.

- [ ] **Step 4: `app/api/assinar/route.ts` — enforcement no servidor**

Após ler o body (linha ~48) e antes de criar o tenant, adicionar:

```ts
if (body.accepted_terms !== true) {
  return bad("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
}
```

> Enforcement server-side impede bypass do checkbox via request direta.

- [ ] **Step 5: Verificar e commitar**

```bash
npm run build
git add components/marketing/SignupForm.tsx app/api/assinar/route.ts
git commit -m "feat(legal): aceite obrigatório de Termos/Privacidade no cadastro"
```

---

### Task 6 (recomendada, opcional): Registrar a data de aceite (prova de consentimento)

Adiciona `terms_accepted_at` à tabela `tenants` como prova de consentimento LGPD. **Depende de migração no Neon** — por isso é separada, para não bloquear o caminho crítico (Tasks 1–5). Pode ser adiada sem impedir o lançamento.

**Files:**
- Modify: `lib/schema.ts` (coluna nova em `tenants`)
- Modify: `lib/db/tenants.ts` (incluir em `TENANT_WRITABLE_FIELDS` se aplicável / setar na criação)
- Modify: `app/api/assinar/route.ts` (gravar `terms_accepted_at: new Date()` no `createTenant`)
- Migration: gerar via drizzle-kit e rodar contra o Neon

- [ ] **Step 1: Adicionar a coluna em `lib/schema.ts` (bloco `tenants`, perto de `document`)**

```ts
/** Timestamp do aceite dos Termos/Privacidade no cadastro (prova LGPD). */
terms_accepted_at: timestamp("terms_accepted_at"),
```

- [ ] **Step 2: Gravar no cadastro (`app/api/assinar/route.ts`, dentro do `createTenant`)**

Acrescentar `terms_accepted_at: new Date()` ao objeto passado para `createTenant(...)`.

- [ ] **Step 3: Gerar a migração**

```bash
npx drizzle-kit generate
```
Esperado: novo arquivo SQL em `drizzle/` com `ALTER TABLE tenants ADD COLUMN terms_accepted_at`.

- [ ] **Step 4: Rodar a migração contra o Neon**

Pelo workflow `migrate.yml` (workflow_dispatch — requer o secret `DATABASE_URL` no GitHub Environment, conforme a migração Vercel/Neon), ou localmente com `DATABASE_URL` do Neon apontado:

```bash
DATABASE_URL="<neon-pooled-url>" npm run db:migrate
```
Esperado: migração aplicada sem erro. Confirmar: `psql "$DATABASE_URL" -c "\d tenants" | grep terms_accepted_at`.

- [ ] **Step 5: Verificar build/testes e commitar**

```bash
npm run build && npm test
git add lib/schema.ts lib/db/tenants.ts app/api/assinar/route.ts drizzle/
git commit -m "feat(legal): registra terms_accepted_at no cadastro (prova de consentimento)"
```

---

## BLOCKER #2 — Validar e endurecer o checkout transparente

A flag `CHECKOUT_MODE=transparent` **já está ON** em produção. A lógica de servidor (`lib/checkout.ts`, `app/api/assinar/pagamento/route.ts`) já tem reconciliação anti-duplo-débito, idempotência e tradução de recusa. Faltam: (a) UX de retry robusta no Card Brick, (b) validação humana em sandbox, (c) validação do webhook.

### Task 7: UX de retry após recusa (remount do Card Brick)

Hoje, ao recusar (402), `app/(public)/assinar/pagamento/page.tsx` mostra o erro e mantém o mesmo Card Brick montado. O Card Payment Brick do MP pode reter o estado do cartão recusado. Forçar um **remount** via `key` garante um formulário limpo para tentar outro cartão.

**Files:**
- Modify: `app/(public)/assinar/pagamento/page.tsx`

- [ ] **Step 1: Adicionar contador de tentativa**

No componente `PaymentPage`, adicionar:

```tsx
const [attempt, setAttempt] = useState(0);
```

- [ ] **Step 2: Incrementar em caso de recusa**

No `handleToken`, no ramo em que `setError(...)` é chamado (pagamento não aprovado), incrementar a tentativa para remontar o brick:

```tsx
setError(data.error ?? "Pagamento não aprovado. Tente outro cartão.");
setAttempt((a) => a + 1);
```

- [ ] **Step 3: Passar `key` ao Card Brick**

```tsx
<CardBrick
  key={attempt}
  amountReais={handoff.amount / 100}
  payerEmail={handoff.email}
  onToken={handleToken}
  onError={() => setError("Erro ao validar o cartão. Confira os dados.")}
/>
```

- [ ] **Step 4: Verificar e commitar**

```bash
npm run build
git add "app/(public)/assinar/pagamento/page.tsx"
git commit -m "fix(checkout): remonta o Card Brick após recusa para permitir novo cartão"
```

---

### Task 8: Roteiro de validação em sandbox (recusa→retry + duplo-débito)

Sem código — é validação manual com o ambiente de teste do Mercado Pago. Registrar o resultado. Requer credenciais de **sandbox** do MP (Access Token de teste + Public Key de teste) num deploy de preview, para não tocar produção.

- [ ] **Step 1: Subir um preview com credenciais de teste do MP**

Num deploy de preview do Vercel, setar (escopo Preview) `MERCADOPAGO_ACCESS_TOKEN` e `NEXT_PUBLIC_MP_PUBLIC_KEY` **de teste** e `CHECKOUT_MODE=transparent`. `vercel --yes` para gerar a URL de preview.

- [ ] **Step 2: Cartões de teste — matriz de recusa**

Fazer um cadastro novo por tentativa (o tenant só recusa enquanto `incomplete`). Usar os cartões de teste do MP (https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/cards) forçando cada `status_detail`:

- [ ] Aprovado (`APRO`) → tenant vira `authorized`, redireciona para `/assinar/sucesso`.
- [ ] Fundos insuficientes (`FUND`) → mensagem "sem saldo ou limite", Card Brick **remonta** e aceita novo cartão.
- [ ] CVV inválido (`SECU`) → mensagem de CVV.
- [ ] Recusa geral (`OTHE`) → mensagem genérica + retry.
- [ ] Após uma recusa, tentar um cartão **aprovado** no mesmo fluxo → deve ativar (prova o retry ponta a ponta).

Confirmar que `isDeclineError` (status 400/402 em `lib/checkout.ts:58`) captura a forma real do erro do SDK — se algum cartão recusado cair no ramo 502 em vez do 402, ajustar `isDeclineError`.

- [ ] **Step 3: Anti-duplo-débito**

Simular timeout ambíguo: aprovar um cartão e, imediatamente, refazer o POST de pagamento com o mesmo `paymentToken` (ex.: recarregar/reenviar). Confirmar via painel do MP que existe **uma única** assinatura para aquele `external_reference` (tenant.id) — a reconciliação (`findReconcilableSubscription`) deve reaproveitar, não criar a segunda.

- [ ] **Step 4: Registrar o resultado**

Anotar no fim de `docs/superpowers/plans/2026-07-20-bloqueadores-lancamento.md` (seção "Resultados da validação") o que passou e qualquer ajuste feito.

---

### Task 9: Validar o webhook do Mercado Pago (ponto cego)

O `notification_url` já é explícito no código (`mpNotificationUrl()`, vai para o apex). Falta confirmar que uma assinatura `pending` é reconciliada para `active` pelo webhook em produção.

- [ ] **Step 1: Localizar a rota do webhook e a URL configurada**

```bash
grep -rn "webhook\|notification\|preapproval" app/api --include="*.ts" | grep -i "route\|POST" | head
grep -rn "mpNotificationUrl\|MERCADOPAGO_WEBHOOK_SECRET" lib app | head
```
Anotar o path exato (ex.: `app/api/mp/webhook/route.ts` ou similar) e confirmar que a URL no painel do MP (Webhooks) aponta para `https://autostand.com.br/<path>`.

- [ ] **Step 2: Disparar e verificar**

No painel do MP, usar "Simular notificação" para o path, ou fazer um pagamento de teste que caia em `pending`. Confirmar nos logs da Vercel (`vercel logs` ou dashboard) que o webhook chegou, validou o HMAC (`MERCADOPAGO_WEBHOOK_SECRET`) e o tenant correspondente virou `active`.

- [ ] **Step 3: Registrar** o resultado na seção "Resultados da validação".

---

## BLOCKER #3 — Anti-abuso: rate-limit (verificar) + Turnstile real

Rate-limit já está ativo (Upstash na Vercel). Turnstile está com chaves de teste que aprovam todo mundo — trocar pelas reais.

### Task 10: Confirmar que o rate-limit está de fato ativo

- [ ] **Step 1: Confirmar as envs na Vercel**

Em Vercel → Settings → Environment Variables (Production), confirmar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` presentes e não-vazias. (Sem elas, `lib/ratelimit.ts` vira no-op silencioso.)

- [ ] **Step 2: Smoke test em produção**

Disparar o endpoint de reset de senha (limite 5/h) além do limite:

```bash
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://autostand.com.br/api/auth/forgot-password \
    -H "Content-Type: application/json" -d '{"email":"naoexiste@example.com"}'
done
```
Esperado: os primeiros retornam 200, e a partir do 6º retorna **429**. Se **nunca** vier 429, o rate-limit não está ativo — reconferir as envs e o redeploy.

---

### Task 11: Trocar o Turnstile pelas chaves reais do Cloudflare

Config + redeploy (o site key é `NEXT_PUBLIC_*`, inlined em build). Sem código.

- [ ] **Step 1: Criar o widget no Cloudflare**

https://dash.cloudflare.com → Turnstile → Add site. Domínios: `autostand.com.br` e `*.autostand.com.br`. Modo: **Managed** (ou Invisible). Anotar o **Site Key** (público) e o **Secret Key**.

- [ ] **Step 2: Setar as envs na Vercel (Production)**

Em Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = site key real
- `TURNSTILE_SECRET_KEY` = secret real

> **Footgun (memória):** as duas juntas ou nenhuma. Setar só o secret sem o site key faz o servidor exigir um token que o widget (sem site key) nunca gera → quebra signup e lead do marketplace. `isTurnstileEnabled()` (`components/Turnstile.tsx:19`) liga o widget pelo site key; `verifyTurnstile` (`lib/turnstile.ts:36`) exige token quando o secret existe.

- [ ] **Step 3: Redeploy (obrigatório — `NEXT_PUBLIC_*` é build-time)**

```bash
vercel --prod
```

- [ ] **Step 4: Smoke test**

Abrir `https://autostand.com.br/assinar` e confirmar que o widget do Turnstile renderiza. Preencher e enviar um cadastro de teste — deve passar pela verificação real. Depois, um POST direto sem token:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://autostand.com.br/api/assinar \
  -H "Content-Type: application/json" -d '{"plan":"basico"}'
```
Esperado: **400** com "Verificação de segurança falhou" (o servidor agora exige token).

> **Nota (fora de escopo, P1):** `app/api/leads/route.ts` tem rate-limit mas **não** valida Turnstile (diferente de `app/api/marketplace/lead/route.ts`). Fechar essa inconsistência é um endurecimento P1 separado — exige também renderizar o widget no formulário que posta em `/api/leads`.

---

## Sequência recomendada

1. **Blocker #1 (Tasks 1–5)** — código + deploy `vercel --prod`. Task 6 (registro de aceite) pode ir junto ou logo depois.
2. **Blocker #3 (Tasks 10–11)** — rápido: confirmar rate-limit + criar/trocar chaves do Turnstile + redeploy.
3. **Blocker #2 (Tasks 7–9)** — Task 7 (código de retry) junto do deploy do #1; Tasks 8–9 são validação em sandbox/prod, feitas por humano.

Em paralelo, tratar os **dois itens urgentes fora de escopo**: deletar o RDS (⏰ 21/07) e rotacionar as credenciais (MP primeiro).

## Resultados da validação

**2026-07-22 — deploy dos Blockers #1 e #3 (branch `feat/bloqueadores-lancamento`):**

- ✅ **Blocker #1 (Tasks 1–5) DEPLOYADO** via `vercel --prod` (deploy `dpl_GrF6…`, alias autostand.com.br). Smoke: `/termos` e `/privacidade` → 200 com conteúdo real (SYNQO); `POST /api/assinar` sem `accepted_terms` → 400 (enforcement server-side); widget de cookies + checkbox de aceite + botão desabilitado confirmados visualmente em `/assinar`.
- ⏸️ **Task 6 (`terms_accepted_at`) REVERTIDA** (commit `e79f092`). Motivo: migração 0004 não pôde ser aplicada — `migrate.yml` aponta pro RDS deletado (`ENOTFOUND`, falha de 21/07 confirmada) e a URL do Neon na Vercel é Sensitive (ilegível via CLI). Deployar o schema com a coluna sem aplicá-la quebraria TODA query de tenants (`getTenantBySlug` em cada request). Reaplicar quando o secret `DATABASE_URL` do GitHub Environment `production` for corrigido pra string do Neon.
- ✅ **Task 7 (remount Card Brick)** no ar (commit `8cadf6e`).
- ✅ **Task 10 (rate-limit)** — smoke `POST /api/auth/forgot-password` 8× do mesmo IP: reqs 1–5 → 200, reqs 6–8 → **429**. Limiter `passwordReset` (5/h) live via Upstash.
- ✅ **Task 11 (Turnstile real)** — widget "AutoStand Produção" criado no Cloudflare (Managed, hostname `autostand.com.br`), site key `0x4AAAAAAD7f_j800E9iPZcF`. Ambas as chaves setadas na Vercel (Production) + `vercel --prod` (deploy `dpl_BBv5…`). Verificado: `dummy` token agora rejeitado no servidor (`POST /api/assinar` → 400 "Verificação de segurança falhou"; antes passava) e widget renderiza em `/assinar`.
- 🔧 **Correção de rota:** fixture de `tests/api/assinar-mode.test.ts` atualizado com `accepted_terms` + teste do enforcement (commit `21bfe25`) — 212 testes verdes.

**Ainda pendente:** Tasks 8–9 (validação sandbox recusa→retry + webhook MP, manual). P1: `/api/leads` não valida Turnstile. Follow-up: corrigir secret Neon no GitHub (destrava Task 6 + migrações futuras), rotação de credenciais, PR pra `main`.

**2026-07-23 — validação do checkout via diagnóstico do superadmin (`console.autostand.com.br/superadmin/diagnostico`):**

Em vez do preview com credenciais de sandbox (bloqueado — creds do preview não confirmadas), usou-se a ferramenta embutida `PaymentDiagnostics`, que roda o **mesmo** `createTransparentSubscription` do cliente (reconcile + `idempotencyKey: sub-${tenant.id}`) contra as credenciais de **produção** (R$1 real, cartão real, tenant `diag-` isolado com limpeza embutida).

- ✅ **Task 8 — happy path PROVADO.** PIX de teste → `approved`. Fluxo transparente R$1: Card Brick real → pagamento `authorized` → tenant `diag-mrxtra3b` **active** → assinatura MP real (`c21a5de5…`). O `active` veio da via **síncrona** (`fluxo-teste/pagar` → `setTenantSubscriptionState("authorized")` → `MP_STATUS_MAP` mapeia p/ `active`), não do webhook.
- ✅ **Task 9 — webhook PROVADO em produção com eventos reais** (logs da Vercel):
  - `15:09:27 POST /fluxo-teste/pagar 200` → `15:09:31 POST /api/webhooks/mercadopago 200` (webhook `authorized` real do MP; `200` ⇒ HMAC validou — assinatura inválida daria `401`).
  - `15:09:48 DELETE /fluxo-teste 200` (limpeza) → `15:09:49 POST /api/webhooks/mercadopago 200` (webhook `cancelled` real). Tenant `diag-` cancelado no MP + apagado; nada ficou cobrando.
- ⚠️ **Não coberto ainda:** (a) **anti-duplo-débito** (Step 3) não foi exercido explicitamente — mecanismo (`findReconcilableSubscription` + idempotencyKey) está no mesmo caminho já provado, mas falta um reenvio deliberado do mesmo token; (b) **matriz de recusa forçada** `FUND`/`SECU`/`OTHE` + remount do Card Brick (Task 7) — os cartões de teste do MP só respondem em **sandbox**, então o diagnóstico de produção não força as recusas. Precisa do preview sandbox OU um cartão real que recuse (CVV/limite ruim) para o retry.

**Conclusão:** o núcleo do Blocker #2 (cobrança correta ponta a ponta + webhook) está validado em produção. Resta a matriz de recusa (não-crítica para o go-live do happy path) e um teste explícito de idempotência.
