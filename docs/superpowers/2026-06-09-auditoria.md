# Auditoria de Segurança + Qualidade de Código — AutoStand

**Data:** 2026-06-09  
**Escopo:** Codebase completa pós-implementação do sistema de cupons + configurações de storefront.  
**Método:** Dois agentes independentes — um focado em segurança, outro em qualidade/escalabilidade.

---

## Parte 1 — Segurança e Vulnerabilidades

### 🔴 CRÍTICO

#### CRIT-1: `/api/cupons/validate` sem rate limiting — enumeração de códigos trivial
**Arquivo:** `app/api/cupons/validate/route.ts`  
**Vetor:** Endpoint público, sem autenticação e sem rate limit. Atacante envia milhares de GETs com códigos adivinhados (`PROMO10`, `LAUNCH50`, etc.) para descobrir cupons válidos. A resposta é binária e determinista. Pior: a resposta de sucesso expõe `id`, `discount_type` e `discount_value` internos.  
**Impacto:** Cupom de lançamento pode ser descoberto e esgotado em segundos antes de usuários legítimos usarem.  
**Fix:**
```typescript
// Adicionar em lib/ratelimit.ts:
// couponValidate: makeLimiter(10, "1 m", "rl:coupon"),

// Em app/api/cupons/validate/route.ts:
const rl = await checkRateLimit("couponValidate", ip);
if (!rl.ok) return NextResponse.json({ valid: false }, { status: 429 });

// Remover id, discount_type, discount_value da resposta — cliente só precisa de preview e discountedCents
```

---

#### CRIT-2: `AUTH_SECRET` de produção armazenado em arquivo local
**Arquivo:** `.env.vercel.local` (gitignored)  
**Vetor:** Arquivo contém o `AUTH_SECRET` real do NextAuth. Se vazar (log de CI/CD, acidente de commit, comprometimento da máquina do dev), permite forjar tokens de sessão e impersonar qualquer usuário, incluindo `super_admin`.  
**Fix:** Verificar `git log --all -- .env.vercel.local` para garantir que nunca foi commitado. Rotacionar o `AUTH_SECRET` na Vercel/GitHub Actions como medida preventiva.

---

### 🟠 ALTO

#### HIGH-1: `GET /api/assinatura` sem autenticação — vaza URL de gestão de assinatura MP
**Arquivo:** `app/api/assinatura/route.ts`  
**Vetor:** `getAdminTenant()` resolve o tenant pelo header `Host`, sem verificar sessão. Qualquer visitante pode acessar `loja-alvo.autostand.com.br/api/assinatura` e obter a URL de gestão de assinatura MercadoPago do tenant.  
**Fix:** Adicionar `const session = await auth(); if (!session?.user?.tenantId) return 401;` no início do handler.

---

#### HIGH-2: `scripts/seed.ts` cria super_admin com senha `super123` sem guard de produção
**Arquivo:** `scripts/seed.ts`, linhas 223–224, 341  
**Vetor:** Se executado contra o banco de produção (`DATABASE_URL` apontando para Turso prod), cria um super_admin com credenciais conhecidas e as imprime em plaintext no stdout.  
**Fix:**
```typescript
if (process.env.NODE_ENV === "production") {
  console.error("ABORT: seed não deve rodar em produção.");
  process.exit(1);
}
const superPass = process.env.SUPER_ADMIN_PASSWORD;
if (!superPass) throw new Error("SUPER_ADMIN_PASSWORD env obrigatória");
```

---

#### HIGH-3: `POST /api/leads` sem rate limiting nem CAPTCHA
**Arquivo:** `app/api/leads/route.ts`  
**Vetor:** Endpoint público sem proteção. Atacante pode encher o CRM de uma concessionária com milhares de leads falsos.  
**Fix:** Espelhar o padrão de `app/api/marketplace/lead/route.ts` — adicionar `checkRateLimit("lead", ip)` e `verifyTurnstile`.

---

### 🟡 MÉDIO

#### MED-1: Stack trace vaza para o cliente no catch de `/api/assinar`
**Arquivo:** `app/api/assinar/route.ts`, linha 108  
**Código atual:** `return NextResponse.json({ error: (err as Error).message }, { status: 400 });`  
**Impacto:** Erros do Drizzle/Turso, SDK do MercadoPago e bcrypt são expostos ao cliente. Pode revelar schema interno, plano IDs, estado da conta MP.  
**Fix:** Logar o erro internamente (`console.error`) e retornar mensagem genérica: `"Erro interno. Tente novamente."` com status 500.

---

#### MED-2: Rate limiting vulnerável a IP spoofing via `X-Forwarded-For`
**Arquivo:** `lib/ratelimit.ts`, linhas 77–80  
**Vetor:** `getClientIp()` usa o primeiro valor do header `X-Forwarded-For`. No CloudFront, se o header não for sobrescrito/sanitizado antes de chegar ao ECS, atacante pode enviar `X-Forwarded-For: 1.2.3.4` arbitrário e contornar o rate limiting.  
**Fix:** Configurar CloudFront para usar `CloudFront-Viewer-Address` como header confiável, ou usar o último hop de `X-Forwarded-For` (não o primeiro).

---

#### MED-3: Sem headers de segurança HTTP (CSP, X-Frame-Options, HSTS)
**Arquivo:** `next.config.ts`  
**Fix:**
```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ],
  }];
}
```

---

#### MED-4: `GET /api/cupons/validate` expõe ID interno do cupom
**Arquivo:** `app/api/cupons/validate/route.ts`, linha 50  
**Fix:** Remover `id` da resposta — o `/api/assinar` refaz a busca por código no servidor, cliente nunca precisa do ID.

---

### 🟢 BAIXO / INFORMATIVO

- **LOW-1:** Sem middleware centralizado de autenticação — uma rota nova esquecida de proteger fica silenciosamente pública.
- **LOW-2:** Turnstile e Redis falham abertos por design — se ambos ficarem indisponíveis durante um ataque, as defesas caem simultaneamente.
- **LOW-3:** PDFs no S3 sem `ContentDisposition: attachment` — browsers podem renderizar inline.
- **LOW-4:** PATCH superadmin de tenants permite setar `referred_by` e `coupon_id` arbitrários sem validação de negócio.

---

## Parte 2 — Qualidade de Código e Escalabilidade

### 🏗️ Problemas de Arquitetura

#### ARCH-1: Fluxo de cadastro não é atômico — falha parcial cria registros órfãos
**Arquivo:** `app/api/assinar/route.ts`, linhas 79–103  
**Problema:** A sequência `incrementCouponUse` → `createTenant` → `createUser` → `incrementPartnerSignup` não está em uma transaction. Se `createUser` falhar (race condition de e-mail duplicado, timeout do DB), o uso do cupom já foi consumido e o tenant fica suspenso sem usuário admin associado.  
**Fix:** Envolver `createTenant` + `createUser` + `incrementPartnerSignup` em `db.transaction()`.

---

#### ARCH-2: `deleteTenant` executa 8 DELETEs sequenciais sem transaction
**Arquivo:** `lib/db/tenants.ts`, linhas 105–116  
**Problema:** Uma falha no meio deixa o banco num estado parcialmente deletado.  
**Fix:** Envolver em `db.transaction()`.

---

#### ARCH-3: N+1 writes no reordenamento de fotos e itens "Sobre"
**Arquivos:** `lib/db/vehicles.ts:179–192`, `lib/db/about.ts:54–65`  
**Problema:** Cada item reordenado gera um UPDATE individual — round-trip HTTP separado para o Turso. Para 15 fotos = 15 requests sequenciais dentro de uma transaction. Latência visível no drag-and-drop.  
**Fix:** Usar `db.batch()` do Turso para enviar todos os UPDATEs em um único round-trip.

---

#### ARCH-4: Subqueries correlacionadas em `getFinanceiroPorVeiculo` — O(n) por venda
**Arquivo:** `lib/db/transactions.ts`, linhas 304–332  
**Problema:** Dois `SELECT SUM(...)` correlacionados executam para cada linha de venda no resultado.  
**Fix:** Substituir por `LEFT JOIN` agrupado.

---

#### ARCH-5: `getFinanceiroResumo` faz 3 queries ao banco em série
**Arquivo:** `lib/db/transactions.ts`, linhas 255–282  
**Fix:** `Promise.all([q1, q2, q3])` — as 3 queries são independentes.

---

### 🐛 Bugs

#### BUG-1: `sql\`${transactions.type} IN ${filters.types}\`` — SQL inválido silencioso
**Arquivo:** `lib/db/transactions.ts`, linha 34  
**Problema:** Passar array diretamente para tagged template `sql` no Drizzle serializa o array como string única, não como valores separados. `WHERE type IN (?)` nunca matches. Resultado: filtro financeiro por múltiplos tipos retorna zero linhas silenciosamente.  
**Fix:** `inArray(transactions.type, filters.types)` do Drizzle ORM.

---

#### BUG-2: Aritmética de centavos ambígua em `createDiscountedMpPlan`
**Arquivo:** `lib/checkout.ts`, linhas 15–28  
**Problema:** Cálculo de desconto percentual divide por 100 duas vezes e multiplica de volta — acidentalmente correto, mas frágil.  
**Fix:** Unificar a fórmula com o padrão estabelecido em `baseBRL` na linha 11.

---

### ⚡ Qualidade e Manutenibilidade

#### QUAL-1: `withSuperAdmin` usa `userId: 0` como fallback silencioso
**Arquivo:** `lib/api.ts`, linha 71  
**Problema:** Se `session.user.id` for falsy, `userId` injetado nos handlers é `0` — corrompendo dados de auditoria silenciosamente.  
**Fix:** Lançar erro em vez de usar fallback.

---

#### QUAL-2: `POST /api/superadmin/cupons` não usa Zod — única rota nesse padrão
**Arquivo:** `app/api/superadmin/cupons/route.ts`, linhas 10–54  
**Problema:** Usa `req.json()` raw e coerção manual. `Number(undefined)` produz `NaN` silenciosamente no banco.  
**Fix:** Extrair schema Zod e usar `parseBody(req, createCouponSchema)`.

---

#### QUAL-3: `PersonalizarEditor` tem 17 `useState` individuais — re-render total a cada tecla
**Arquivo:** `components/admin/PersonalizarEditor.tsx`, linhas 75–97  
**Problema:** 17 estados independentes para um formulário salvo atomicamente. Cada keystroke re-renderiza o componente inteiro + preview (inclui 3 `VehicleCard`s).  
**Fix:** Agrupar em `useReducer` ou poucos `useState` por seção (branding, textos, layout, social, bancos).

---

#### QUAL-4: `zoom: 0.62` no preview — CSS não-padrão, quebra no Firefox
**Arquivo:** `components/admin/PersonalizarEditor.tsx`, linha 571  
**Fix:** `transform: scale(0.62); transform-origin: top left` com ajuste de `width`/`height`.

---

### 🚀 Quick Wins (alto valor, baixo esforço)

| # | Item | Arquivo | Esforço |
|---|------|---------|---------|
| QW-1 | `getVehicleWithPhotos` — 2 queries sequenciais → `Promise.all` | `lib/db/vehicles.ts:59–66` | 1 linha |
| QW-2 | `getFinanceiroResumo` — 3 queries sequenciais → `Promise.all` | `lib/db/transactions.ts:255–282` | 1 linha |
| QW-3 | Cache em `getCurrentTenant` via `unstable_cache` (60s TTL) | `lib/tenant.ts:45–62` | ~10 linhas |
| QW-4 | `formatBRL` duplicado em 3 arquivos — centralizar em `lib/money.ts` | Vários | 5 min |
| QW-5 | `searchMarketplaceVehicles` — count + data query em paralelo | `lib/marketplace.ts:208–222` | 1 linha |

---

### 📊 Inventário de Dívida Técnica (priorizado por impacto)

| Prioridade | Item | Arquivo | Impacto |
|-----------|------|---------|---------|
| **P0** | Fluxo de cadastro não atômico | `app/api/assinar/route.ts:79–103` | Corrupção de dados sob carga |
| **P0** | `sql IN ${array}` SQL inválido — BUG silencioso | `lib/db/transactions.ts:34` | Relatório financeiro quebrado |
| **P1** | `deleteTenant` não transacional | `lib/db/tenants.ts:105–116` | Integridade de dados |
| **P1** | N+1 writes no reordenamento (Turso round-trips) | `lib/db/vehicles.ts:179–192` | Latência visível |
| **P1** | `withSuperAdmin` userId=0 silencioso | `lib/api.ts:71` | Corrupção de auditoria |
| **P2** | Subqueries correlacionadas em relatório financeiro | `lib/db/transactions.ts:313–325` | Performance ao crescer |
| **P2** | 17 useState no PersonalizarEditor | `components/admin/PersonalizarEditor.tsx:75–97` | UX degradada |
| **P2** | POST cupons sem Zod | `app/api/superadmin/cupons/route.ts` | NaN silencioso no banco |
| **P3** | `zoom: 0.62` quebra no Firefox | `components/admin/PersonalizarEditor.tsx:571` | Bug visual |
| **P3** | Sem cache em `getCurrentTenant` | `lib/tenant.ts:45–62` | Escalabilidade |
| **P3** | Queries sequenciais desnecessárias | Vários | Latência evitável |
| **P3** | `formatBRL` duplicado | Vários | Inconsistência futura |
| **P4** | Zero testes de integração no layer de API | `tests/` | Regressões não detectadas |

---

## Resumo Executivo

**Segurança:** 2 críticos, 3 altos. O mais urgente é adicionar rate limiting ao `/api/cupons/validate` (CRIT-1) — trivial de implementar e com alto impacto. `AUTH_SECRET` (CRIT-2) requer rotação preventiva. `GET /api/assinatura` sem auth (HIGH-1) é uma correção de 5 linhas.

**Qualidade:** 2 bugs P0 reais — o `sql IN ${array}` (BUG-1) provavelmente já está quebrando o relatório financeiro silenciosamente. O fluxo de cadastro não atômico (ARCH-1) é risco de dados em produção. Ambos precisam de correção antes de qualquer expansão de funcionalidade.

**Escalabilidade:** SQLite/Turso aguenta bem com a arquitetura atual. Os gargalos reais surgirão primeiro nos N+1 writes de reordenamento e nas queries sequenciais desnecessárias — todos são quick wins de performance.
