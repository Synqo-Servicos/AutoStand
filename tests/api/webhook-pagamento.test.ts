import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const recordPayment = vi.fn();
const getPaymentByMpId = vi.fn();
const updatePayment = vi.fn();
const getTenantById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const paymentGet = vi.fn();
const preApprovalGet = vi.fn();

vi.mock("@/lib/db", () => ({
  recordPayment,
  getPaymentByMpId,
  updatePayment,
  getTenantById,
  setTenantSubscriptionState,
}));
vi.mock("@/lib/email/notify", () => ({ notifyPaymentStatus: vi.fn() }));
vi.mock("mercadopago", () => ({
  default: class {
    constructor() {}
  },
  MercadoPagoConfig: class {
    constructor() {}
  },
  PreApproval: class {
    get = preApprovalGet;
  },
  Payment: class {
    get = paymentGet;
  },
}));

const WEBHOOK_SECRET = "s";

/**
 * O handler exige assinatura HMAC válida (`x-signature`/`x-request-id`)
 * ANTES de olhar `body.type` — isso vale pra toda notificação, não só
 * `preapproval`. Um `headers.get()` que sempre devolve `""` faria
 * `verifySignature` retornar false incondicionalmente e o handler 401 antes
 * de qualquer lógica de pagamento rodar. Em vez de afrouxar a verificação de
 * assinatura no handler (regressão de segurança num endpoint público) pra
 * acomodar um stub de teste mudo, este `req()` assina a requisição com o
 * MESMO HMAC que o handler valida.
 */
function req(body: { type: string; data: { id: string } }) {
  const dataId = body.data.id;
  const ts = "1700000000";
  const xRequestId = "req-1";
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex");
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        if (name === "x-signature") return `ts=${ts},v1=${v1}`;
        if (name === "x-request-id") return xRequestId;
        return "";
      },
    },
  } as never;
}

/** Requisição com uma assinatura HMAC deliberadamente inválida (não bate
 * com o secret configurado) — pro caso negativo de segurança (achado 7). */
function reqBadSignature(body: { type: string; data: { id: string } }) {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        if (name === "x-signature") return "ts=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000";
        if (name === "x-request-id") return "req-1";
        return "";
      },
    },
  } as never;
}

describe("webhook — notificação de cobrança", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
    getTenantById.mockResolvedValue({
      id: 7,
      name: "Auto Brasil",
      document: "123",
      plan: "pro",
      coupon_id: null,
      mp_subscription_id: "preap-7",
    });
    paymentGet.mockResolvedValue({
      id: 999,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    // Usado só pelo caminho `preapproval`, inalterado por esta task — precisa
    // resolver pra algo coerente pra não quebrar o handler existente.
    preApprovalGet.mockResolvedValue({ status: "authorized", external_reference: "7" });
    recordPayment.mockResolvedValue({ created: true });
  });

  it("grava o pagamento com bruto, taxa e líquido em centavos", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        mp_payment_id: "999",
        gross_cents: 24990,
        fee_cents: 1200,
        net_cents: 23790,
        status: "approved",
        incomplete: false,
      }),
    );
  });

  it("congela nome e documento do pagador na linha", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_name: "Auto Brasil",
        tenant_document: "123",
      }),
    );
  });

  it("taxa ausente: net = gross e marca incomplete", async () => {
    paymentGet.mockResolvedValueOnce({
      id: 998,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "998" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        fee_cents: null,
        net_cents: 24990,
        incomplete: true,
      }),
    );
  });

  it("falha ao buscar no MP não grava linha pela metade", async () => {
    paymentGet.mockRejectedValueOnce(new Error("MP fora do ar"));
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    const res = await POST(req({ type: "payment", data: { id: "997" } }));
    expect(recordPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("notificação de preapproval continua não gravando pagamento", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "preapproval", data: { id: "pre-1" } }));
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("estorno de pagamento já registrado ATUALIZA o status, não é descartado", async () => {
    recordPayment.mockResolvedValueOnce({ created: false });
    getPaymentByMpId.mockResolvedValueOnce({
      id: 1,
      mp_payment_id: "999",
      status: "approved",
      incomplete: false,
      fee_cents: 1200,
      net_cents: 23790,
      paid_at: "2026-08-15T12:00:00.000Z",
    });
    paymentGet.mockResolvedValueOnce({
      id: 999,
      status: "refunded",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(updatePayment).toHaveBeenCalledWith("999", expect.objectContaining({ status: "refunded" }));
  });

  // --- Achado 1 (revisão rodada 1): reentrega fora de ordem não reverte um estorno ---
  it("reentrega fora de ordem NÃO reverte um estorno já gravado (approved chegando depois de refunded)", async () => {
    recordPayment.mockResolvedValueOnce({ created: false });
    // A linha já está `refunded` (o estorno chegou primeiro). Esta
    // notificação é o retry ATRASADO do `approved` original.
    getPaymentByMpId.mockResolvedValueOnce({
      id: 1,
      mp_payment_id: "999",
      status: "refunded",
      incomplete: false,
      fee_cents: 1200,
      net_cents: 23790,
      paid_at: "2026-08-15T12:00:00.000Z",
    });
    paymentGet.mockResolvedValueOnce({
      id: 999,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(updatePayment).toHaveBeenCalledTimes(1);
    const patch = updatePayment.mock.calls[0][1] as Record<string, unknown>;
    // Nem sequer tenta escrever "approved" — a chave fica de fora do patch.
    expect(patch).not.toHaveProperty("status");
    expect(patch.status).not.toBe("approved");
  });

  // --- Achado 2 (revisão rodada 1): reentrega com dados melhores não fica congelada ---
  it("reentrega com taxa melhor que a gravada atualiza fee/net/incomplete", async () => {
    recordPayment.mockResolvedValueOnce({ created: false });
    // A 1ª notificação gravou a linha `pending`/sem taxa (`incomplete: true`).
    getPaymentByMpId.mockResolvedValueOnce({
      id: 1,
      mp_payment_id: "999",
      status: "pending",
      incomplete: true,
      fee_cents: null,
      net_cents: 24990,
      paid_at: "2026-08-15T11:00:00.000Z",
    });
    // Esta reentrega já é `approved`, com taxa.
    paymentGet.mockResolvedValueOnce({
      id: 999,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 12.0 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(updatePayment).toHaveBeenCalledWith(
      "999",
      expect.objectContaining({
        status: "approved",
        fee_cents: 1200,
        net_cents: 23790,
        incomplete: false,
        paid_at: "2026-08-15T12:00:00.000-03:00",
      }),
    );
  });

  // --- Achado 3 (revisão rodada 1): net_received_amount tem prioridade; fee_payer é filtrado ---
  it("prefere transaction_details.net_received_amount do MP, derivando a taxa por gross - net", async () => {
    paymentGet.mockResolvedValueOnce({
      id: 995,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      transaction_details: { net_received_amount: 236.9 },
      // Deliberadamente "errado" — prova que NÃO é usado quando
      // net_received_amount está presente.
      fee_details: [{ amount: 999.0 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "995" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ gross_cents: 24990, net_cents: 23690, fee_cents: 1300, incomplete: false }),
    );
  });

  it("ignora fee_details com fee_payer=payer — não é despesa nossa", async () => {
    paymentGet.mockResolvedValueOnce({
      id: 994,
      status: "approved",
      transaction_amount: 249.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [
        { amount: 12.0, fee_payer: "collector" },
        { amount: 5.0, fee_payer: "payer" },
      ],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "994" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ fee_cents: 1200, net_cents: 23790, incomplete: false }),
    );
  });

  // --- Achado 4 (revisão rodada 1): tipo desconhecido loga, não some em silêncio ---
  it("tipo de notificação desconhecido gera console.warn e não grava nada", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "merchant_order", data: { id: "mo-1" } }));
    expect(recordPayment).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("não tratado"), "merchant_order");
    warnSpy.mockRestore();
  });

  // --- Achado 5 (revisão rodada 1, prova por mutação): tenant resolvido pelo
  // ARGUMENTO passado a getTenantById, não pelo que o mock devolve ---
  it("resolve o tenant pelo external_reference do pagamento (argumento capturado, não o retorno do mock)", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "999" } }));
    expect(getTenantById).toHaveBeenCalledWith(7);
  });

  // --- Achado 6 (revisão rodada 1, prova por mutação): Math.round, não Math.trunc.
  // 249.9 não discrimina (24990 é exato); 19.9*100 = 1989.9999999999998 e
  // 2.51*100 = 250.99999999999997 — round e trunc DIVERGEM aqui. ---
  it("arredonda pra centavos com Math.round (valor que discrimina de Math.trunc)", async () => {
    paymentGet.mockResolvedValueOnce({
      id: 993,
      status: "approved",
      transaction_amount: 19.9,
      date_approved: "2026-08-15T12:00:00.000-03:00",
      external_reference: "7",
      fee_details: [{ amount: 2.51 }],
    });
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    await POST(req({ type: "payment", data: { id: "993" } }));
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ gross_cents: 1990, fee_cents: 251, net_cents: 1739 }),
    );
  });

  // --- Achado 7 (revisão rodada 1, prova por mutação): assinatura inválida → 401 ---
  it("assinatura HMAC inválida devolve 401 e não chama recordPayment", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");
    const res = await POST(reqBadSignature({ type: "payment", data: { id: "999" } }));
    expect(res.status).toBe(401);
    expect(recordPayment).not.toHaveBeenCalled();
  });
});
