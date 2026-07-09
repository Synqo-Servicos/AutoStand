import { describe, it, expect, vi, beforeEach } from "vitest";

const paymentCreate = vi.fn();
const paymentGet = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "super_admin" } })),
  getApiTenantId: vi.fn(),
}));
vi.mock("mercadopago", () => ({
  default: class MercadoPagoConfig {
    constructor(_opts: unknown) {}
  },
  Payment: class {
    create = paymentCreate;
    get = paymentGet;
  },
}));

function req(url = "http://x/api/superadmin/pix-teste", body?: unknown) {
  return { url, json: async () => body, headers: new Headers() } as never;
}
const ctx = { params: Promise.resolve({}) } as never;

describe("superadmin/pix-teste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-TOKEN";
  });

  it("POST cria PIX e devolve QR + copia-e-cola", async () => {
    paymentCreate.mockResolvedValue({
      id: 123,
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code: "000201COPIA",
          qr_code_base64: "BASE64==",
          ticket_url: "https://mp/ticket",
        },
      },
    });
    const { POST } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await POST(req(), ctx);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toMatchObject({
      id: "123",
      status: "pending",
      amount: 0.01,
      qrCode: "000201COPIA",
      qrCodeBase64: "BASE64==",
      ticketUrl: "https://mp/ticket",
    });
    expect(paymentCreate).toHaveBeenCalledWith({
      body: {
        transaction_amount: 0.01,
        description: "AutoStand — diagnóstico de pagamento",
        payment_method_id: "pix",
        payer: { email: "diagnostico@autostand.com.br" },
      },
    });
  });

  it("GET ?id devolve status", async () => {
    paymentGet.mockResolvedValue({ id: 123, status: "approved", status_detail: "accredited" });
    const { GET } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await GET(req("http://x/api/superadmin/pix-teste?id=123"), ctx);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ id: "123", status: "approved", statusDetail: "accredited" });
    expect(paymentGet).toHaveBeenCalledWith({ id: "123" });
  });

  it("POST sem token → 503", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const { POST } = await import("@/app/api/superadmin/pix-teste/route");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(503);
  });
});
