import { describe, it, expect } from "vitest";
import {
  leadNotification, paymentActive, paymentPastDue, paymentCancelled,
  passwordReset, superadminNewSubscription, superadminPaymentFailure,
  upcomingBills,
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

describe("upcomingBills", () => {
  const bills = [
    { label: "Aluguel — Imobiliária Costa", dueDate: "2026-08-16", amountCents: 450_000, status: "a_vencer" as const },
    { label: "Energia — Equatorial", dueDate: "2026-08-13", amountCents: null, status: "vence_hoje" as const },
  ];

  it("põe a contagem no assunto", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x/admin/financeiro", bills });
    expect(r.subject).toContain("2");
  });

  it("lista cada conta com data formatada em pt-BR", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x", bills });
    expect(r.html).toContain("Aluguel");
    expect(r.html).toContain("16/08/2026");
    expect(r.html).toContain("R$ 4.500,00");
  });

  it("mostra travessão quando não há valor previsto", () => {
    const r = upcomingBills({ dealershipName: "Auto Brasil", panelUrl: "https://x", bills });
    // A linha da "Energia" (amountCents: null) tem que ter a célula de valor
    // preenchida com o travessão — não "R$ NaN", não vazio, não outra coisa.
    const linhaEnergia = r.html.slice(r.html.indexOf("Energia"), r.html.indexOf("</tr>", r.html.indexOf("Energia")));
    expect(linhaEnergia).toMatch(/text-align:right;white-space:nowrap">\s*—\s*<\/td>/);
    expect(linhaEnergia).not.toContain("R$");
  });

  it("escapa HTML no nome do fornecedor", () => {
    const r = upcomingBills({
      dealershipName: "Auto Brasil",
      panelUrl: "https://x",
      bills: [{ label: "<script>alert(1)</script>", dueDate: "2026-08-16", amountCents: 100, status: "a_vencer" }],
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("destaca as atrasadas", () => {
    const r = upcomingBills({
      dealershipName: "Auto Brasil",
      panelUrl: "https://x",
      bills: [{ label: "IPTU", dueDate: "2026-08-01", amountCents: 90_000, status: "atrasado" }],
    });
    expect(r.subject.toLowerCase()).toContain("atrasada");
  });
});
