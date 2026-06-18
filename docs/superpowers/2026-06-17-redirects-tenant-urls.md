# Redirects e URLs absolutas tenant-scoped — pendências

**Data:** 2026-06-17
**Origem:** investigação do bug de login no homolog (PRs #5 e #6) — o redirect saía para o
hostname interno do ECS. Ao revisar, mapeamos outros pontos onde URLs/redirects deveriam ser
do **tenant** (loja) mas usam o domínio da **plataforma**.

> Status: **documentado, a atacar.** Nada aqui foi corrigido ainda.

---

## Decisão de arquitetura (não reabrir)

**Não** vamos guardar a URL de cada tenant numa coluna no banco. A URL canônica de uma loja
já é fonte única e derivável:

- `lib/marketplace.ts` → `tenantSiteUrl(loja)` = `https://${custom_domain || `${slug}.${PLATFORM_DOMAIN}`}`
- A tabela `tenants` já tem `slug` (→ subdomínio) e `custom_domain`.

Guardar a URL completa como string seria **redundante e quebraria entre ambientes**: o mesmo
registro (`autoprime`) é servido em `autoprime.homologation.autostand.com.br` (homolog) e
`autoprime.autostand.com.br` (prod) — só muda o `PLATFORM_DOMAIN`. A versão derivada respeita o
ambiente; uma string fixa não. **Sempre usar `tenantSiteUrl(tenant)` para montar URLs de loja.**

---

## 1. [BUG confirmado] `back_url` do Mercado Pago aponta pra plataforma

**Arquivo:** `lib/checkout.ts:39`, em `createDiscountedMpPlan(plan, coupon)`

```ts
back_url: `https://${process.env.PLATFORM_DOMAIN ?? "autostand.com.br"}/admin/assinatura`,
```

**Problema:** depois de assinar, o Mercado Pago redireciona o lojista para esse `back_url`.
Ele aponta para o host da **plataforma** (`{PLATFORM_DOMAIN}/admin/assinatura`), que **não tem
tenant**. O fluxo `/admin`:
- `app/admin/(protected)/layout.tsx:17` → `getAdminTenant()`
- `app/admin/(protected)/assinatura/page.tsx:19` → `getAdminTenant()`

`getAdminTenant()` no host da plataforma → `getCurrentTenant()` retorna `null` → `notFound()`
→ **404 após pagar**. Pior: o cookie de sessão é host-only do subdomínio da loja, então no host
da plataforma o lojista também estaria **deslogado**.

**Correção:** passar `tenant` para `createDiscountedMpPlan` e usar o site do tenant:

```ts
back_url: `${tenantSiteUrl(tenant)}/admin/assinatura`,
```

(Só afeta o caminho **com cupom** — é o único que cria o plano via API com `back_url` no código.)

**Escopo do diff:**
- `createDiscountedMpPlan(plan, coupon)` → `createDiscountedMpPlan(tenant, plan, coupon)`.
- `import { tenantSiteUrl } from "@/lib/marketplace"` em `lib/checkout.ts`.
- Atualizar a chamada em `createCheckoutSession` (já tem `tenant` em mãos).

---

## 2. [Config a verificar] `back_url` dos planos pré-criados (caminho SEM cupom)

`createCheckoutSession` sem cupom usa `plan.mpPlanId` (os planos `MERCADOPAGO_PLAN_BASICO/PRO/
PREMIUM`), criados **fora do código**, no painel do Mercado Pago. O `back_url` deles está
configurado lá — provavelmente apontando para o domínio da plataforma, com o **mesmo problema
do item 1**.

**Ação:** conferir/ajustar o `back_url` desses planos no painel do MP. Como o `back_url` é
fixo por plano (não por tenant), não dá para deixar tenant-scoped num plano compartilhado.
Opções:
- **(a)** Usar um `back_url` neutro que funcione sem tenant (ex.: uma página da plataforma que
  redireciona o lojista logado para o admin da sua loja), **ou**
- **(b)** Sempre criar o plano on-the-fly por checkout (como no caminho com cupom) para poder
  setar `back_url` por tenant. Custo: uma chamada a mais ao MP por checkout.

Decidir antes de implementar.

---

## 3. [Auditar — SEO, prioridade menor] `metadataBase` global = plataforma

**Arquivo:** `app/layout.tsx:7` → `metadataBase: new URL(PLATFORM_ORIGIN)`

Como é o layout raiz, as páginas de **vitrine do tenant** herdam `metadataBase` = origin da
plataforma. URLs relativas em OG/canonical viram `https://autostand.com.br/...` em vez de
`https://<loja>/...`. Pode gerar canonical/preview errados para as lojas.

**Ação:** auditar se as páginas públicas de loja (`app/(public)/loja/...`, `comprar/...`)
sobrescrevem `metadataBase`/canonical por tenant. Se não, considerar derivar por tenant via
`tenantSiteUrl()`. Não é quebra funcional — é higiene de SEO.

---

## Pontos que JÁ estão corretos (não mexer)

- `app/(public)/loja/[slug]/page.tsx:21` → `permanentRedirect(tenantSiteUrl(loja))` ✅
- `comprar/[id]`, `lojas` → `tenantSiteUrl(loja)` ✅
- `sitemap.ts`, `robots.ts` → `PLATFORM_ORIGIN` (são da plataforma/marketplace, corretos) ✅
- `marketplace/page.tsx` → mostra `{PLATFORM_DOMAIN}/loja/{slug}` como texto (listagem no
  marketplace, que vive no domínio da plataforma) ✅
- `notification_url` (webhook MP) → deve continuar na plataforma (infra da plataforma) ✅

---

## Aceite (quando atacarmos)

1. Checkout **com cupom** → após pagar, o MP retorna para `https://<loja>/admin/assinatura`
   (subdomínio ou custom_domain), com sessão preservada e **sem 404**.
2. Checkout **sem cupom** → mesmo comportamento (depende da decisão do item 2).
3. `tsc --noEmit` + `npm test` verdes.
4. Verificação E2E no homolog: assinar uma loja e confirmar o retorno no host da loja.
