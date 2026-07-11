import { describe, it, expect } from "vitest";
import {
  leadNotification, paymentActive, paymentPastDue, paymentCancelled,
  passwordReset, superadminNewSubscription, superadminPaymentFailure,
} from "@/lib/email/templates";

describe("templates de e-mail", () => {
  it("leadNotification: assunto + nome/telefone/veículo/link no corpo", () => {
    const r = leadNotification({
      leadName: "João Silva", phone: "11999998888",
      message: "Tenho interesse", vehicleTitle: "Onix 2020",
      panelUrl: "https://loja.autostand.com.br/admin/leads",
    });
    expect(r.subject).toBe("Novo lead: João Silva");
    expect(r.html).toContain("João Silva");
    expect(r.html).toContain("11999998888");
    expect(r.html).toContain("Onix 2020");
    expect(r.html).toContain("https://loja.autostand.com.br/admin/leads");
  });

  it("leadNotification: escapa HTML do input (anti-injection no corpo)", () => {
    const r = leadNotification({ leadName: "<script>x</script>", phone: "1", panelUrl: "u" });
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("paymentActive: link do site + painel", () => {
    const r = paymentActive({ siteUrl: "https://loja.autostand.com.br", panelUrl: "https://loja.autostand.com.br/admin" });
    expect(r.subject).toMatch(/no ar/i);
    expect(r.html).toContain("https://loja.autostand.com.br");
  });

  it("paymentPastDue: aponta pra atualizar pagamento", () => {
    const r = paymentPastDue({ panelUrl: "https://loja.autostand.com.br/admin" });
    expect(r.html).toContain("/admin/assinatura");
  });

  it("paymentCancelled: assunto de cancelamento", () => {
    expect(paymentCancelled().subject).toMatch(/cancelad/i);
  });

  it("passwordReset: contém o link de reset", () => {
    const r = passwordReset({ resetUrl: "https://autostand.com.br/resetar-senha?token=abc" });
    expect(r.html).toContain("https://autostand.com.br/resetar-senha?token=abc");
  });

  it("alertas de super-admin: nome da loja no assunto", () => {
    expect(superadminNewSubscription({ dealershipName: "Auto Prime", plan: "Pro" }).subject).toContain("Auto Prime");
    expect(superadminPaymentFailure({ dealershipName: "Auto Prime", status: "past_due" }).subject).toContain("Auto Prime");
  });
});
