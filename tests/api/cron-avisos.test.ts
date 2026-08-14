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

  it("envia o digest e reivindica antes", async () => {
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(res.status).toBe(200);
    expect(claimNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
    expect(notifyUpcomingBills).toHaveBeenCalledTimes(1);
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

  it("devolve o claim quando o envio falha", async () => {
    notifyUpcomingBills.mockRejectedValue(new Error("SMTP fora do ar"));
    const { GET } = await import("@/app/api/cron/avisos-vencimento/route");

    const res = await GET(req("s3cr3t"));

    expect(releaseNotifications).toHaveBeenCalledWith(7, "vencimento", ["1:2026-08-16:d3"]);
    expect(res.status).toBe(200); // um tenant com falha não derruba os demais
  });
});
