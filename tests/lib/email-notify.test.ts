import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TenantRow } from "@/lib/schema";

const sendEmail = vi.fn();
const getSuperAdminEmails = vi.fn();
const getTenantAdminEmail = vi.fn();

vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/db", () => ({ getSuperAdminEmails, getTenantAdminEmail }));
vi.mock("@/lib/marketplace", () => ({
  tenantSiteUrl: (t: { slug: string }) => `https://${t.slug}.autostand.com.br`,
}));

const TENANT = {
  id: 7, slug: "autoprime", name: "Auto Prime", plan: "pro",
  contact_email: "loja@autoprime.com", custom_domain: null,
} as unknown as TenantRow;

describe("notifyNewLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(true);
    getTenantAdminEmail.mockResolvedValue(null);
  });

  it("envia pro contact_email do tenant, assunto com o nome do lead", async () => {
    const { notifyNewLead } = await import("@/lib/email/notify");
    await notifyNewLead(TENANT, { name: "João", phone: "11999", message: "oi" });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "loja@autoprime.com", subject: "Novo lead: João" }),
    );
  });

  it("cai no e-mail do admin quando não há contact_email", async () => {
    getTenantAdminEmail.mockResolvedValue("admin@autoprime.com");
    const { notifyNewLead } = await import("@/lib/email/notify");
    await notifyNewLead({ ...TENANT, contact_email: null }, { name: "João", phone: "11999" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@autoprime.com" }));
  });

  it("não envia quando não há destinatário", async () => {
    const { notifyNewLead } = await import("@/lib/email/notify");
    await notifyNewLead({ ...TENANT, contact_email: null }, { name: "João", phone: "11999" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("nunca lança quando o lookup falha", async () => {
    getTenantAdminEmail.mockRejectedValue(new Error("db down"));
    const { notifyNewLead } = await import("@/lib/email/notify");
    await expect(
      notifyNewLead({ ...TENANT, contact_email: null }, { name: "João", phone: "1" }),
    ).resolves.toBeUndefined();
  });
});

describe("notifyPaymentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(true);
    getTenantAdminEmail.mockResolvedValue(null);
    getSuperAdminEmails.mockResolvedValue(["super@x.com"]);
  });

  it("active: 'no ar' pro cliente + 'nova assinatura' pros super-admins", async () => {
    const { notifyPaymentStatus } = await import("@/lib/email/notify");
    await notifyPaymentStatus(TENANT, "active");
    const msgs = sendEmail.mock.calls.map((c) => c[0]);
    expect(msgs.some((m) => m.to === "loja@autoprime.com" && /no ar/i.test(m.subject))).toBe(true);
    expect(msgs.some((m) => Array.isArray(m.to) && m.to.includes("super@x.com") && /nova assinatura/i.test(m.subject))).toBe(true);
  });

  it("past_due: 'atualize' pro cliente + 'falha' pros super-admins", async () => {
    const { notifyPaymentStatus } = await import("@/lib/email/notify");
    await notifyPaymentStatus(TENANT, "past_due");
    const subjects = sendEmail.mock.calls.map((c) => c[0].subject).join(" | ");
    expect(subjects).toMatch(/atualize/i);
    expect(subjects).toMatch(/falha de pagamento/i);
  });

  it("ignora tenant diag- (nenhum e-mail)", async () => {
    const { notifyPaymentStatus } = await import("@/lib/email/notify");
    await notifyPaymentStatus({ ...TENANT, slug: "diag-abc" }, "active");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("status desconhecido: nada", async () => {
    const { notifyPaymentStatus } = await import("@/lib/email/notify");
    await notifyPaymentStatus(TENANT, "whatever");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
