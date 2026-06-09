# Storefront Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor as configurações de storefront que já existem no banco mas não aparecem no site público, e completar os campos de edição que faltam no painel admin.

**Context:** Após exploração do codebase, o schema, a Zod validation e o PersonalizarEditor **já têm** as redes sociais (facebook, youtube, tiktok, twitter), seção "Sobre" com CRUD, upload de logo/hero, slogan, contact CTA, etc. Os gaps reais são dois:

1. **Redes sociais não renderizadas no site público** — `ContactSection` em `Storefront.tsx` exibe só WhatsApp e Instagram; as outras redes são salvas mas invisíveis para o visitante.
2. **Campos sem UI no admin** — `business_hours`, `contact_email` e `city` existem no schema e no Zod mas não têm campos no `PersonalizarEditor.tsx`. `city` também não está no `tenantStorefrontSchema`.

**Tech Stack:** Next.js App Router, Tailwind CSS, Lucide React, Drizzle ORM + Turso (SQLite), Zod.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `components/public/StorefrontFooter.tsx` | Criar | Footer público com redes sociais (pills), contact_email, copyright |
| `components/public/Storefront.tsx` | Modificar | Incluir `<StorefrontFooter>` ao final |
| `lib/schemas.ts` | Modificar | Adicionar `city` ao `tenantStorefrontSchema` |
| `components/admin/PersonalizarEditor.tsx` | Modificar | Adicionar campos `business_hours`, `contact_email`, `city` ao bloco de contato |

**Sem migrations necessárias.** Todos os campos já existem no schema Drizzle e na tabela Turso.

---

## Task 1 — Footer público com redes sociais

**Arquivo:** `components/public/StorefrontFooter.tsx` (criar)
**Arquivo:** `components/public/Storefront.tsx` (modificar)

### O que fazer

Criar um componente de footer que exibe:
- **Pills de redes sociais** (condicionais — só renderiza se o campo estiver preenchido):
  - WhatsApp — link `https://wa.me/{number}`, ícone MessageCircle (lucide)
  - Instagram — link direto, ícone Instagram (lucide) *(já está no ContactSection; manter lá e adicionar no footer)*
  - Facebook — link direto
  - YouTube — link direto
  - TikTok — link direto
  - Twitter / X — link direto
- **E-mail de contato** — `mailto:` link, só se `contact_email` preenchido
- **Copyright** — `© {ano} {tenant.name}`

### Design

Footer simples com fundo `var(--brand-primary)` (cor da marca), texto branco.
Pills como `<a>` com borda branca translúcida e hover opaco.
Layout: centralizado, redes em linha, copyright abaixo.

```tsx
// estrutura aproximada
<footer className="bg-[var(--brand-primary)] py-8 px-4">
  <div className="max-w-3xl mx-auto text-center">
    {/* pills de redes */}
    <div className="flex flex-wrap justify-center gap-3 mb-4">
      {tenant.whatsapp_number && <SocialPill href={waHref} label="WhatsApp" />}
      {tenant.instagram_url && <SocialPill href={tenant.instagram_url} label="Instagram" />}
      {tenant.facebook_url && <SocialPill href={tenant.facebook_url} label="Facebook" />}
      {tenant.youtube_url && <SocialPill href={tenant.youtube_url} label="YouTube" />}
      {tenant.tiktok_url && <SocialPill href={tenant.tiktok_url} label="TikTok" />}
      {tenant.twitter_url && <SocialPill href={tenant.twitter_url} label="X" />}
    </div>
    {/* e-mail */}
    {tenant.contact_email && (
      <a href={`mailto:${tenant.contact_email}`} className="text-white/80 text-sm hover:text-white">
        {tenant.contact_email}
      </a>
    )}
    {/* copyright */}
    <p className="text-white/50 text-xs mt-4">
      © {new Date().getFullYear()} {tenant.name}
    </p>
  </div>
</footer>
```

### Checklist

- [ ] Criar `components/public/StorefrontFooter.tsx` com:
  - [ ] Props: `tenant: TenantRow`, `waHref: string`
  - [ ] Componente interno `SocialPill` com `href` e `label`
  - [ ] Condicional para cada rede social (renderiza só se campo preenchido)
  - [ ] Condicional para contact_email
  - [ ] Copyright com nome da loja
- [ ] Em `Storefront.tsx`: importar e renderizar `<StorefrontFooter tenant={tenant} waHref={waHref} />` após `<ContactSection>`
- [ ] Verificar TypeScript sem erros (`npx tsc --noEmit`)
- [ ] Commit: `feat(storefront): add public footer with social links`

---

## Task 2 — Campos faltantes no PersonalizarEditor

**Arquivo:** `lib/schemas.ts` (modificar)
**Arquivo:** `components/admin/PersonalizarEditor.tsx` (modificar)

### O que fazer

**2a. Adicionar `city` ao `tenantStorefrontSchema` em `lib/schemas.ts`**

Localizar `tenantStorefrontSchema` (zona dos campos de contato) e adicionar:
```typescript
city: trimmed(80).nullable().optional(),
```

**2b. Adicionar campos no `PersonalizarEditor.tsx`**

Os três campos faltantes vão no bloco de contato (após `address`, por volta das linhas 328-330):

1. `city` — "Cidade" — `<input>` com placeholder ex: "Brasília – DF", maxLength 80
2. `contact_email` — "E-mail de contato" — `<input type="email">` com validação básica, placeholder "contato@sualooja.com.br"
3. `business_hours` — "Horário de atendimento" — `<input>` com placeholder "Seg–Sáb, 8h–18h", maxLength 80

Para cada campo:
- Adicionar `useState` no topo do componente (linha ~80, junto aos outros)
- Incluir no objeto de save (linha ~154)
- Adicionar o `<label>` + `<input>` no JSX do bloco de contato

**Estado:**
```tsx
const [city, setCity] = useState(tenant.city ?? "");
const [contactEmail, setContactEmail] = useState(tenant.contact_email ?? "");
const [businessHours, setBusinessHours] = useState(tenant.business_hours ?? "");
```

**Save payload:**
```tsx
city: city || null,
contact_email: contactEmail || null,
business_hours: businessHours || null,
```

### Checklist

- [ ] Em `lib/schemas.ts`: adicionar `city: trimmed(80).nullable().optional()` ao `tenantStorefrontSchema`
- [ ] Em `PersonalizarEditor.tsx`:
  - [ ] Adicionar `useState` para `city`, `contactEmail`, `businessHours`
  - [ ] Incluir os 3 campos no payload de save
  - [ ] Adicionar campos de formulário no bloco de contato:
    - [ ] Campo "Cidade" (`city`)
    - [ ] Campo "E-mail de contato" (`contact_email`)
    - [ ] Campo "Horário de atendimento" (`business_hours`)
- [ ] Verificar TypeScript sem erros (`npx tsc --noEmit`)
- [ ] Commit: `feat(admin): add city, contact_email, business_hours fields to personalizar`

---

## Verificação final

```bash
npx tsc --noEmit     # zero erros
npm run test         # testes existentes passando
```

Testar manualmente em dev:
1. Editar uma loja no `/admin/personalizar` — preencher Facebook, TikTok, city, contact_email, business_hours
2. Salvar
3. Abrir o storefront público da loja — confirmar footer com pills das redes e email de contato
