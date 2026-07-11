import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.GMAIL_USER = "contato.synqo@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    delete process.env.EMAIL_FROM_NAME;
    sendMail.mockResolvedValue({ messageId: "x" });
  });

  it("envia via gmail com From 'AutoStand <...>' e retorna true", async () => {
    const { sendEmail } = await import("@/lib/email/send");
    const ok = await sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>oi</p>" });
    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "AutoStand <contato.synqo@gmail.com>",
        to: "a@b.com",
        subject: "Oi",
        html: "<p>oi</p>",
      }),
    );
  });

  it("no-op + false quando não há GMAIL_APP_PASSWORD (kill-switch)", async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    const { sendEmail } = await import("@/lib/email/send");
    const ok = await sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>oi</p>" });
    expect(ok).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("engole erro do transporte e retorna false (não lança)", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    const { sendEmail } = await import("@/lib/email/send");
    await expect(sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>oi</p>" })).resolves.toBe(false);
  });
});
