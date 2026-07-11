import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserByEmail = vi.fn();
const sendEmail = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/db", () => ({ getUserByEmail }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit, getClientIp: () => "1.2.3.4" }));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret";
    process.env.PLATFORM_DOMAIN = "autostand.com.br";
    checkRateLimit.mockResolvedValue({ ok: true });
    getUserByEmail.mockResolvedValue({ id: 5, email: "a@b.com", password: "hash" });
    sendEmail.mockResolvedValue(true);
  });

  it("usuário existe → envia e-mail com link de reset e 200", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    const msg = sendEmail.mock.calls[0][0];
    expect(msg.to).toBe("a@b.com");
    expect(msg.html).toContain("https://autostand.com.br/resetar-senha?token=");
  });

  it("usuário não existe → 200 sem enviar (não vaza)", async () => {
    getUserByEmail.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(req({ email: "x@y.com" }));
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("e-mail inválido → 200 sem enviar", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    await POST(req({ email: "naoemail" }));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rate-limited → 429", async () => {
    checkRateLimit.mockResolvedValue({ ok: false, retryAfter: 60 });
    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(429);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
