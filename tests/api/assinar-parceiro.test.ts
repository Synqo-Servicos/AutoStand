import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Decisão comercial vigente (ver `lib/db/partners.ts` e `docs/Modelo de Dados.md`):
 * o link `?parceiro=` faz ATRIBUIÇÃO, não preço. Quem dá desconto é o CUPOM.
 * `partners.discount_type`/`discount_value` são campos mortos.
 *
 * Estes testes existem para impedir que a promessa e a cobrança se separem de
 * novo: até ago/2026 a tela de cadastro dizia "o desconto é aplicado no
 * pagamento" e o cliente indicado pagava o preço cheio.
 */

const createTenant = vi.fn();
const createUser = vi.fn();
const getTenantBySlug = vi.fn();
const getUserByEmail = vi.fn();
const getCouponByCode = vi.fn();
const getPartnerByCode = vi.fn();
const incrementCouponUse = vi.fn();
const incrementPartnerSignup = vi.fn();
const createCheckoutSession = vi.fn();
const signPaymentToken = vi.fn();
const verifyTurnstile = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
  createTenant, createUser, getTenantBySlug, getUserByEmail,
  getCouponByCode, getPartnerByCode, incrementCouponUse, incrementPartnerSignup,
}));
vi.mock("@/lib/checkout", () => ({ createCheckoutSession }));
vi.mock("@/lib/payment-token", () => ({ signPaymentToken }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed") } }));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

const BASICO_CENTS = 16990;

const VALID = {
  plan: "basico", slug: "minhaloja", dealership_name: "Minha Loja",
  document: "52998224725",
  admin_name: "João", admin_email: "joao@loja.com", admin_password: "senha1234",
  partner_code: "joao-despachante", coupon_code: null, turnstile_token: "tok",
  accepted_terms: true,
};

/** Parceiro com desconto configurado no /superadmin — que NÃO deve virar preço. */
const PARTNER_COM_DESCONTO = {
  id: 7,
  name: "João Despachante",
  code: "joao-despachante",
  discount_type: "percent",
  discount_value: 15,
  status: "active",
  signup_count: 0,
  max_uses: null,
  expires_at: null,
};

describe("POST /api/assinar — parceiro é atribuição, não desconto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CHECKOUT_MODE;
    verifyTurnstile.mockResolvedValue(true);
    getTenantBySlug.mockResolvedValue(null);
    getUserByEmail.mockResolvedValue(null);
    getCouponByCode.mockResolvedValue(null);
    getPartnerByCode.mockResolvedValue(PARTNER_COM_DESCONTO);
    createTenant.mockResolvedValue({ id: 42, slug: "minhaloja" });
    createUser.mockResolvedValue({ id: 1 });
    createCheckoutSession.mockResolvedValue("https://mp/checkout");
    signPaymentToken.mockReturnValue("signed.token");
  });

  it("modo transparent: cadastro por link de parceiro cobra a mensalidade cheia", async () => {
    process.env.CHECKOUT_MODE = "transparent";
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));
    const json = await res.json();

    expect(res.status).toBe(201);
    // O parceiro tem 15% configurado no painel — e mesmo assim o valor é cheio.
    // Se um dia isso mudar (decisão comercial), a faixa de indicação em
    // app/(public)/assinar/page.tsx precisa voltar a prometer o desconto.
    expect(json.amount).toBe(BASICO_CENTS);
  });

  it("modo redirect: createCheckoutSession não recebe parceiro (só tenant, plano e cupom)", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(createCheckoutSession).toHaveBeenCalledOnce();
    const args = createCheckoutSession.mock.calls[0];
    // 3 argumentos: (tenant, plan, coupon). O 4º parâmetro "_partner" que
    // nunca era lido foi removido — não deve voltar.
    expect(args).toHaveLength(3);
    expect(args[2]).toBeNull();
    expect(args).not.toContainEqual(expect.objectContaining({ code: "joao-despachante" }));
  });

  it("a atribuição continua acontecendo: referred_by + signup_count", async () => {
    const { POST } = await import("@/app/api/assinar/route");
    await POST(req(VALID));

    expect(createTenant).toHaveBeenCalledWith(
      expect.objectContaining({ referred_by: 7 }),
      expect.anything(),
    );
    expect(incrementPartnerSignup).toHaveBeenCalledWith(7, expect.anything());
  });

  it("o desconto real vem do cupom, mesmo num cadastro por link de parceiro", async () => {
    process.env.CHECKOUT_MODE = "transparent";
    getCouponByCode.mockResolvedValue({
      id: 3, code: "PROMO10", description: null,
      discount_type: "percentage", discount_value: 10,
      max_uses: 10, used_count: 0, expires_at: null,
      created_by: 1, partner_id: 7, created_at: "",
    });
    incrementCouponUse.mockResolvedValue(true);

    const { POST } = await import("@/app/api/assinar/route");
    const res = await POST(req({ ...VALID, coupon_code: "PROMO10" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.amount).toBe(15291); // 16990 - 10%
  });
});

describe("tela /assinar — a faixa de indicação não pode prometer desconto automático", () => {
  const pagePath = path.join(process.cwd(), "app", "(public)", "assinar", "page.tsx");

  it("o arquivo da página existe no caminho esperado", () => {
    expect(existsSync(pagePath)).toBe(true);
  });

  it("não promete que o desconto do parceiro é aplicado no pagamento", () => {
    const source = readFileSync(pagePath, "utf8");
    // Regressão do Critical: "Indicação de X — o desconto é aplicado no
    // pagamento." era falso, o parceiro nunca entrou no cálculo de preço.
    const banner = source.slice(source.indexOf("{partner &&"));
    expect(banner).not.toMatch(/desconto\s+é\s+aplicado/i);
  });

  it("aponta o cupom como o caminho real do desconto", () => {
    const source = readFileSync(pagePath, "utf8");
    const banner = source.slice(source.indexOf("{partner &&"));
    expect(banner).toMatch(/cupom/i);
  });
});
