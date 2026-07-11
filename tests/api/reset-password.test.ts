import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserById = vi.fn();
const setUserPassword = vi.fn();
const verifyResetToken = vi.fn();
const passwordFingerprint = vi.fn();

vi.mock("@/lib/db", () => ({ getUserById, setUserPassword }));
vi.mock("@/lib/reset-token", () => ({ verifyResetToken, passwordFingerprint }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed") } }));

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyResetToken.mockReturnValue({ userId: 5, pf: "PF" });
    getUserById.mockResolvedValue({ id: 5, password: "hash" });
    passwordFingerprint.mockReturnValue("PF");
    setUserPassword.mockResolvedValue(undefined);
  });

  it("token válido + pf bate → define a senha e 200", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(req({ token: "t", password: "novasenha123" }));
    expect(res.status).toBe(200);
    expect(setUserPassword).toHaveBeenCalledWith(5, "hashed");
  });

  it("token inválido → 400 sem trocar senha", async () => {
    verifyResetToken.mockReturnValue(null);
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(req({ token: "x", password: "novasenha123" }));
    expect(res.status).toBe(400);
    expect(setUserPassword).not.toHaveBeenCalled();
  });

  it("pf não bate (link já usado / senha mudou) → 400", async () => {
    passwordFingerprint.mockReturnValue("OUTRO");
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(req({ token: "t", password: "novasenha123" }));
    expect(res.status).toBe(400);
    expect(setUserPassword).not.toHaveBeenCalled();
  });

  it("senha curta → 400", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(req({ token: "t", password: "123" }));
    expect(res.status).toBe(400);
    expect(setUserPassword).not.toHaveBeenCalled();
  });

  it("verify lança (AUTH_SECRET ausente) → 503", async () => {
    verifyResetToken.mockImplementation(() => {
      throw new Error("no secret");
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(req({ token: "t", password: "novasenha123" }));
    expect(res.status).toBe(503);
  });
});
