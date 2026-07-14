import { describe, it, expect, vi, beforeEach } from "vitest";
import { PHOTO_MAX_BYTES } from "@/lib/blob-constants";

// A rota de presign é a única fronteira de confiança que sobrou: depois dela
// o browser fala direto com o S3. Ela precisa (a) exigir sessão, (b) recusar
// MIME/tamanho fora da regra do kind, (c) confirmar que o veículo é do tenant
// da sessão, e (d) devolver uma key que o servidor gerou — nunca uma que o
// cliente escolheu.

const getApiTenantId = vi.fn();
const auth = vi.fn();
const getVehicle = vi.fn();
const getPhotosByVehicle = vi.fn();
const presignPut = vi.fn();

vi.mock("@/lib/auth", () => ({ getApiTenantId, auth }));
vi.mock("@/lib/db", () => ({ getVehicle, getPhotosByVehicle }));
vi.mock("@/lib/s3", () => ({
  presignPut,
  CDN_URL: "https://cdn.autostand.com.br",
  HAS_S3: true,
}));

function req(body: unknown) {
  return { json: async () => body } as never;
}
const ctx = { params: Promise.resolve({}) };

async function post(body: unknown) {
  const { POST } = await import("@/app/api/uploads/presign/route");
  const res = await POST(req(body), ctx);
  return { status: res.status, body: await res.json() };
}

describe("POST /api/uploads/presign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiTenantId.mockResolvedValue(7);
    getVehicle.mockResolvedValue({ id: 42, tenant_id: 7 });
    getPhotosByVehicle.mockResolvedValue([]);
    presignPut.mockResolvedValue("https://s3.example/signed");
  });

  it("401 sem sessão de tenant", async () => {
    getApiTenantId.mockResolvedValue(null);
    const res = await post({
      kind: "photo",
      contentType: "image/jpeg",
      size: 1024,
      vehicleId: 42,
    });
    expect(res.status).toBe(401);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("assina o PUT e devolve uploadUrl + key + publicUrl", async () => {
    const res = await post({
      kind: "photo",
      contentType: "image/jpeg",
      size: 1024,
      vehicleId: 42,
    });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe("https://s3.example/signed");
    expect(res.body.key).toMatch(/^tenants\/7\/vehicles\/42\/\d+-[a-z0-9]+\.jpg$/);
    expect(res.body.publicUrl).toBe(`https://cdn.autostand.com.br/${res.body.key}`);
    // Content-Type e tamanho vão FIXADOS na assinatura — sem isso o cliente
    // poderia subir qualquer coisa, de qualquer tamanho, com a URL assinada.
    expect(presignPut).toHaveBeenCalledWith(res.body.key, "image/jpeg", 1024);
  });

  it("devolve os headers exatos que o cliente precisa mandar no PUT", async () => {
    const res = await post({
      kind: "document",
      contentType: "application/pdf",
      size: 2048,
      vehicleId: 42,
    });
    expect(res.status).toBe(200);
    expect(res.body.headers).toEqual({ "Content-Type": "application/pdf" });
    expect(res.body.key).toMatch(/^tenants\/7\/vehicles\/42\/docs\/\d+-[a-z0-9]+\.pdf$/);
  });

  it("400 em MIME não permitido — e não assina nada", async () => {
    const res = await post({
      kind: "photo",
      contentType: "application/pdf",
      size: 1024,
      vehicleId: 42,
    });
    expect(res.status).toBe(400);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("413 acima do limite do kind — e não assina nada", async () => {
    const res = await post({
      kind: "photo",
      contentType: "image/jpeg",
      size: PHOTO_MAX_BYTES + 1,
      vehicleId: 42,
    });
    expect(res.status).toBe(413);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("400 em kind desconhecido", async () => {
    const res = await post({ kind: "backup", contentType: "image/jpeg", size: 10 });
    expect(res.status).toBe(400);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("404 quando o veículo não é do tenant da sessão", async () => {
    getVehicle.mockResolvedValue(null);
    const res = await post({
      kind: "photo",
      contentType: "image/jpeg",
      size: 1024,
      vehicleId: 999,
    });
    expect(res.status).toBe(404);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("413 quando o veículo já está no limite de fotos", async () => {
    getPhotosByVehicle.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ url: `u${i}` })),
    );
    const res = await post({
      kind: "photo",
      contentType: "image/jpeg",
      size: 1024,
      vehicleId: 42,
    });
    expect(res.status).toBe(413);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("branding não precisa de veículo e não consulta o banco", async () => {
    const res = await post({ kind: "logo", contentType: "image/png", size: 1024 });
    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^tenants\/7\/branding\/logo\/\d+-[a-z0-9]+\.png$/);
    expect(getVehicle).not.toHaveBeenCalled();
  });

  it("ignora qualquer `key` mandada pelo cliente — a key é sempre do servidor", async () => {
    const res = await post({
      kind: "logo",
      contentType: "image/png",
      size: 1024,
      key: "tenants/99/branding/logo/pwned.png",
    });
    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^tenants\/7\/branding\/logo\//);
  });
});
