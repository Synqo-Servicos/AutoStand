import { describe, it, expect, vi, beforeEach } from "vitest";

const createLead = vi.fn();
const listLeads = vi.fn();
const getCurrentTenant = vi.fn();
const verifyTurnstile = vi.fn();
const notifyNewLead = vi.fn();

vi.mock("@/lib/db", () => ({ createLead, listLeads }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant }));
// lib/api arrasta o next-auth pro grafo do módulo; o POST público não usa nada dele.
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  withTenant: () => () => {},
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/email/notify", () => ({ notifyNewLead }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

const VALID = {
  name: "Maria",
  phone: "11999998888",
  message: "Tenho interesse no Onix.",
  source: "site",
  turnstile_token: "tok",
};

describe("POST /api/leads — Turnstile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstile.mockResolvedValue(true);
    getCurrentTenant.mockResolvedValue({ id: 7, slug: "minhaloja" });
    createLead.mockResolvedValue({ id: 1, name: "Maria" });
  });

  it("rejeita quando o Turnstile não valida — sem gravar o lead", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const { POST } = await import("@/app/api/leads/route");

    const res = await POST(req(VALID));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Verificação de segurança/i);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("passa o token e o IP do cliente para o verificador", async () => {
    const { POST } = await import("@/app/api/leads/route");

    await POST(req(VALID));

    expect(verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
  });

  it("grava o lead quando o Turnstile valida", async () => {
    const { POST } = await import("@/app/api/leads/route");

    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(createLead).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: "Maria", phone: "11999998888", source: "site" }),
    );
  });

  it("verifica o captcha antes de resolver o tenant pelo host", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const { POST } = await import("@/app/api/leads/route");

    await POST(req(VALID));

    expect(getCurrentTenant).not.toHaveBeenCalled();
  });
});
