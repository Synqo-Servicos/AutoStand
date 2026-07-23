import { describe, it, expect, vi, beforeEach } from "vitest";

// Segurança: o DELETE de fotos NÃO pode apagar o blob no S3 sem antes
// confirmar que a URL pertence a uma foto do tenant+veículo da sessão —
// senão um admin de loja apaga a foto (URL pública) de outra loja.

const getApiTenantId = vi.fn();
const getPhotosByVehicle = vi.fn();
const deletePhoto = vi.fn();
const updateVehicle = vi.fn();
const deleteFromBlob = vi.fn();

vi.mock("@/lib/auth", () => ({ getApiTenantId }));

vi.mock("@/lib/db", () => ({
  getPhotosByVehicle,
  deletePhoto,
  updateVehicle,
  addPhoto: vi.fn(),
  getVehicle: vi.fn(),
  reorderVehiclePhotos: vi.fn(),
}));

vi.mock("@/lib/blob", () => ({
  deleteFromBlob,
  publicUrlForKey: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  parseBody: vi.fn(),
  withTenant: () => () => {},
}));

vi.mock("@/lib/validation", () => ({
  photoReorderSchema: {},
  photoCreateSchema: {},
}));

function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = { params: Promise.resolve({ id: "1" }) };

const OWNED = "https://cdn.autostand.com.br/tenants/7/vehicles/1/mine.jpg";
const OTHER = "https://cdn.autostand.com.br/tenants/99/vehicles/5/theirs.jpg";

describe("DELETE /api/vehicles/[id]/photos — cross-tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiTenantId.mockResolvedValue(7);
    getPhotosByVehicle.mockResolvedValue([{ url: OWNED, order_idx: 0 }]);
  });

  it("recusa (404) e NÃO apaga o blob quando a URL não é do tenant/veículo", async () => {
    const { DELETE } = await import("@/app/api/vehicles/[id]/photos/route");
    const res = await DELETE(req({ url: OTHER }), params);
    expect(res.status).toBe(404);
    expect(deleteFromBlob).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it("apaga o blob quando a URL pertence ao tenant/veículo", async () => {
    const { DELETE } = await import("@/app/api/vehicles/[id]/photos/route");
    const res = await DELETE(req({ url: OWNED }), params);
    expect(res.status).toBe(200);
    expect(deleteFromBlob).toHaveBeenCalledWith(OWNED);
    expect(deletePhoto).toHaveBeenCalledWith(7, OWNED);
  });
});
