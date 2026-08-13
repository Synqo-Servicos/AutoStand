import { describe, it, expect, vi, beforeEach } from "vitest";

// Adição além do brief da Task 6 (que só cobre o presign com teste
// automatizado): a rota mudou de `url` (input do brief) pra `key` — ver
// comentário em app/api/payables/[id]/anexos/route.ts — e este teste
// trava exatamente a garantia que motivou a mudança: uma key fora da
// pasta tenants/{tenantId}/payables é recusada ANTES de virar URL gravada
// (que o DELETE, mais tarde, apagaria do S3 confiando cegamente no banco).

const getPayable = vi.fn();
const getTransaction = vi.fn();
const addPayableAttachment = vi.fn();
const deletePayableAttachment = vi.fn();

vi.mock("@/lib/db", () => ({
  getPayable, getTransaction, addPayableAttachment, deletePayableAttachment,
}));

const deleteFromBlob = vi.fn();
vi.mock("@/lib/blob", () => ({
  deleteFromBlob,
  publicUrlForKey: (key: string) => `https://cdn.autostand.com.br/${key}`,
}));

// Mesmo padrão de tests/api/payables-pagar.test.ts — withTenant REAL, só
// @/lib/auth mockado. vi.importActual("@/lib/api") quebra no ESM do vitest
// (cadeia @/lib/api → @/lib/auth → next-auth importa "next/server" sem
// extensão) e um withTenant falso não exerceria o try/catch que converte
// ApiError em resposta HTTP — exatamente o que os casos 400/404 abaixo testam.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getApiTenantId: vi.fn().mockResolvedValue(7),
}));

const post = (body: unknown) => ({ json: async () => body, url: "http://x" }) as never;
const del = (url: string) => ({ nextUrl: new URL(url) }) as never;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

const CONTA = { id: 1, tenant_id: 7 };
const KEY = "tenants/7/payables/1700000000000-abc123.pdf";

describe("POST /api/payables/[id]/anexos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPayable.mockResolvedValue(CONTA);
    addPayableAttachment.mockResolvedValue({ id: 10, url: `https://cdn.autostand.com.br/${KEY}` });
  });

  it("grava o anexo com a URL derivada da key no servidor (não a aceita pronta do body)", async () => {
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await POST(post({ key: KEY, name: "boleto.pdf" }), ctx("1"));
    expect(res.status).toBe(201);
    expect(addPayableAttachment).toHaveBeenCalledWith(7, 1, expect.objectContaining({
      name: "boleto.pdf",
      url: `https://cdn.autostand.com.br/${KEY}`,
      transaction_id: null,
      uploaded_by: null,
    }));
  });

  it("404 quando a conta é de outro tenant", async () => {
    getPayable.mockResolvedValue(null);
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await POST(post({ key: KEY, name: "boleto.pdf" }), ctx("1"));
    expect(res.status).toBe(404);
    expect(addPayableAttachment).not.toHaveBeenCalled();
  });

  it("400 quando a key não é da pasta deste tenant (guarda cross-tenant)", async () => {
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const foreignKey = "tenants/99/payables/1700000000000-abc123.pdf";
    const res = await POST(post({ key: foreignKey, name: "boleto.pdf" }), ctx("1"));
    expect(res.status).toBe(400);
    expect(addPayableAttachment).not.toHaveBeenCalled();
  });

  it("404 quando transaction_id não é deste tenant", async () => {
    getTransaction.mockResolvedValue(null);
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await POST(
      post({ key: KEY, name: "comprovante.pdf", transaction_id: 42 }),
      ctx("1"),
    );
    expect(res.status).toBe(404);
    expect(addPayableAttachment).not.toHaveBeenCalled();
  });

  it("aceita transaction_id quando ele pertence ao tenant", async () => {
    getTransaction.mockResolvedValue({ id: 42, tenant_id: 7 });
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await POST(
      post({ key: KEY, name: "comprovante.pdf", transaction_id: 42 }),
      ctx("1"),
    );
    expect(res.status).toBe(201);
    expect(addPayableAttachment).toHaveBeenCalledWith(7, 1, expect.objectContaining({
      transaction_id: 42,
    }));
  });

  it("400 quando o body é inválido (nome vazio)", async () => {
    const { POST } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await POST(post({ key: KEY, name: "" }), ctx("1"));
    expect(res.status).toBe(400);
    expect(addPayableAttachment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/payables/[id]/anexos", () => {
  const ANEXO = { id: 10, url: `https://cdn.autostand.com.br/${KEY}` };

  beforeEach(() => {
    vi.clearAllMocks();
    deleteFromBlob.mockResolvedValue(undefined);
  });

  it("apaga a linha e o blob (best-effort)", async () => {
    deletePayableAttachment.mockResolvedValue(ANEXO);
    const { DELETE } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await DELETE(del("http://x/api/payables/1/anexos?anexo=10"), ctx("1"));
    expect(res.status).toBe(200);
    expect(deletePayableAttachment).toHaveBeenCalledWith(7, 10);
    expect(deleteFromBlob).toHaveBeenCalledWith(ANEXO.url);
  });

  it("404 quando o anexo não existe (ou é de outro tenant) — não tenta apagar blob", async () => {
    deletePayableAttachment.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await DELETE(del("http://x/api/payables/1/anexos?anexo=999"), ctx("1"));
    expect(res.status).toBe(404);
    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("400 quando o parâmetro anexo é inválido", async () => {
    const { DELETE } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await DELETE(del("http://x/api/payables/1/anexos"), ctx("1"));
    expect(res.status).toBe(400);
    expect(deletePayableAttachment).not.toHaveBeenCalled();
  });

  it("falha do S3 é best-effort — não derruba a resposta 200", async () => {
    deletePayableAttachment.mockResolvedValue(ANEXO);
    deleteFromBlob.mockRejectedValue(new Error("s3 indisponível"));
    const { DELETE } = await import("@/app/api/payables/[id]/anexos/route");
    const res = await DELETE(del("http://x/api/payables/1/anexos?anexo=10"), ctx("1"));
    expect(res.status).toBe(200);
  });
});
