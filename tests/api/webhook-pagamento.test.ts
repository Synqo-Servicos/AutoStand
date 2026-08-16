import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const recordPayment = vi.fn();
const updatePaymentStatus = vi.fn();
const getTenantById = vi.fn();
const setTenantSubscriptionState = vi.fn();
const paymentGet = vi.fn();
const preApprovalGet = vi.fn();

vi.mock("@/lib/db", () => ({
  recordPayment,
  updatePaymentStatus,
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
    expect(updatePaymentStatus).toHaveBeenCalledWith("999", "refunded");
  });
});
