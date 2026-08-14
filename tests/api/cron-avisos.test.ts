import { describe, it, expect, vi, beforeEach } from "vitest";

const listTenantsForBillDigest = vi.fn();
const listBills = vi.fn();
const claimNotifications = vi.fn();
const releaseNotifications = vi.fn();
const notifyUpcomingBills = vi.fn();

vi.mock("@/lib/db", () => ({
  listTenantsForBillDigest, listBills, claimNotifications, releaseNotifications,
}));
vi.mock("@/lib/email/notify", () => ({ notifyUpcomingBills }));

const TENANT = { id: 7, name: "Auto Brasil", slug: "auto-brasil", status: "active", contact_email: "x@y.com" };

const req = (secret?: string) =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" && secret ? `Bearer ${secret}` : null) } }) as never;

// D-3 a partir de 2026-08-13 → vence 2026-08-16
const BILL_D3 = {
  payable_id: 1, due_date: "2026-08-16", status: "a_vencer",
  amount_cents: 450_000, category: "Aluguel", supplier: "Imobiliária Costa",
  payment_method: "boleto", description: null, installment: null, installments: null,
};

// Segunda conta, mesmo vencimento/estágio da BILL_D3 — usada para exercitar
// claim PARCIAL (uma reivindica, a outra não), cenário real de uma segunda
// execução do dia com uma conta nova entrando na lista.
const BILL_D3_B = {
  payable_id: 2, due_date: "2026-08-16", status: "a_vencer",
  amount_cents: 12_000, category: "Água", supplier: "Sanepar",
  payment_method: "boleto", description: null, installment: null, installments: null,
};

describe("GET /api/cron/avisos-vencimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T11:00:00Z"));
    listTenantsForBillDigest.mockResolvedValue([TENANT]);
    listBills.mockResolvedValue([BILL_D3]);
    claimNotifications.mockImplementation(async (_t, _k, keys) => keys);
    notifyUpcomingBills.mockResolvedValue(undefined);
  });

  it("401 sem o secret", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("401 com secret errado", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");
    const res = await GET(req("errado"));
    expect(res.status).toBe(401);
  });

  // Sem CRON_SECRET configurado, `Bearer ${secret}` no código vira literalmente
  // "Bearer undefined" — sem a guarda `!secret ||`, um header "Bearer undefined"
  // mandado de propósito bateria com isso e passaria.
  it("401 quando CRON_SECRET não está configurado, mesmo com header 'Bearer undefined' literal", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("undefined"));

    expect(res.status).toBe(401);
    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("envia o digest e reivindica antes", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(res.status).toBe(200);
    expect(claimNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
    expect(notifyUpcomingBills).toHaveBeenCalledTimes(1);
  });

  // 2026-08-14T02:00:00Z = 13/08 às 23h em América/São_Paulo (UTC-3) — o
  // instante em que UTC e o fuso de São Paulo discordam sobre qual dia é
  // "hoje". Sob UTC puro, "hoje" viraria 14/08, o vencimento de 16/08 passaria
  // a D-2 (stageForToday devolve null) e o claim nem seria chamado.
  it("calcula 'hoje' pelo fuso de América/São_Paulo, não pelo UTC do servidor", async () => {
    vi.setSystemTime(new Date("2026-08-14T02:00:00Z"));
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(claimNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
  });

  it("não envia quando o claim volta vazio (já enviado hoje)", async () => {
    claimNotifications.mockResolvedValue([]);
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("não envia quando nenhuma conta se qualifica hoje", async () => {
    listBills.mockResolvedValue([{ ...BILL_D3, due_date: "2026-08-20" }]); // D-7
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(claimNotifications).not.toHaveBeenCalled();
    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  it("ignora conta já paga", async () => {
    listBills.mockResolvedValue([{ ...BILL_D3, status: "pago" }]);
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(notifyUpcomingBills).not.toHaveBeenCalled();
  });

  // Claim parcial: das duas contas elegíveis, só a segunda foi reivindicada
  // (a primeira já saiu numa execução anterior). O e-mail só pode conter a
  // que este processo reivindicou de fato — sem o filtro por claimedSet, as
  // duas entrariam e a primeira seria notificada de novo.
  it("envia só as contas que o claim reivindicou de fato (claim parcial)", async () => {
    listBills.mockResolvedValue([BILL_D3, BILL_D3_B]);
    claimNotifications.mockResolvedValue(["2:2026-08-16:d3"]);
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    await GET(req("s3cr3t"));

    expect(notifyUpcomingBills).toHaveBeenCalledTimes(1);
    const [, lines] = notifyUpcomingBills.mock.calls[0];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ dueDate: "2026-08-16", amountCents: 12_000 });
    expect(lines[0].label).toContain("Sanepar");
  });

  // Mesmo cenário de claim parcial, mas com o envio falhando: o release
  // precisa devolver exatamente o que foi reivindicado (`claimed`), não a
  // lista original de `keys` — senão devolveria uma chave que nunca foi
  // reivindicada por este processo (poderia até já estar reivindicada por
  // outra execução concorrente).
  it("devolve exatamente os claims reivindicados (não os keys originais) quando o envio falha", async () => {
    listBills.mockResolvedValue([BILL_D3, BILL_D3_B]);
    claimNotifications.mockResolvedValue(["2:2026-08-16:d3"]);
    notifyUpcomingBills.mockRejectedValue(new Error("SMTP fora do ar"));
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(releaseNotifications).toHaveBeenCalledWith(7, "vencimento", ["2:2026-08-16:d3"]);
    expect(res.status).toBe(200); // um tenant com falha não derruba os demais
  });
});
