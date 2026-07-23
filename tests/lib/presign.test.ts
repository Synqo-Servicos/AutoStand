import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildUploadKey,
  publicUrlForKey,
  uploadFolder,
  validatePresignInput,
  assertKeyInFolder,
  LOCAL_URL_PREFIX,
} from "@/lib/presign";
import {
  DOC_MAX_BYTES,
  LOGO_MAX_BYTES,
  PHOTO_MAX_BYTES,
  UploadValidationError,
} from "@/lib/blob-constants";

// O upload agora vai DIRETO do browser pro S3 via URL assinada — o servidor
// nunca vê os bytes (o body de uma function na Vercel morre em 4,5MB, na
// borda, antes do handler). Logo, a assinatura É a validação: o que não for
// checado aqui vira um objeto arbitrário no bucket público. Estes testes
// travam as três garantias que sobraram no servidor:
//   1) MIME na allowlist do `kind` (e fixado na assinatura)
//   2) tamanho ≤ limite do `kind` (e fixado na assinatura)
//   3) key gerada pelo servidor, com a MESMA convenção de antes — as URLs
//      já gravadas no banco dependem dela (keyFromCdnUrl / s3Delete).

const CDN = "https://cdn.autostand.com.br";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadFolder — convenção de pastas (idêntica à de lib/blob.ts)", () => {
  it("foto de veículo", () => {
    expect(uploadFolder("photo", 7, 42)).toBe("tenants/7/vehicles/42");
  });

  it("documento de veículo", () => {
    expect(uploadFolder("document", 7, 42)).toBe("tenants/7/vehicles/42/docs");
  });

  it("branding (logo e hero)", () => {
    expect(uploadFolder("logo", 7)).toBe("tenants/7/branding/logo");
    expect(uploadFolder("hero", 7)).toBe("tenants/7/branding/hero");
  });

  it("exige vehicleId quando o kind é de veículo", () => {
    expect(() => uploadFolder("photo", 7)).toThrow(UploadValidationError);
    expect(() => uploadFolder("document", 7)).toThrow(UploadValidationError);
  });
});

describe("validatePresignInput — MIME", () => {
  it("rejeita MIME fora da allowlist", () => {
    expect(() =>
      validatePresignInput({
        kind: "photo",
        contentType: "application/x-msdownload",
        size: 1024,
        vehicleId: 42,
      }, 7),
    ).toThrow(UploadValidationError);
  });

  it("rejeita PDF em foto (só imagens) mas aceita em documento", () => {
    expect(() =>
      validatePresignInput(
        { kind: "photo", contentType: "application/pdf", size: 1024, vehicleId: 42 },
        7,
      ),
    ).toThrow(/não permitido/i);

    expect(
      validatePresignInput(
        { kind: "document", contentType: "application/pdf", size: 1024, vehicleId: 42 },
        7,
      ).ext,
    ).toBe("pdf");
  });

  it("status 400 no erro de MIME", () => {
    try {
      validatePresignInput(
        { kind: "logo", contentType: "image/gif", size: 10 },
        7,
      );
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(UploadValidationError);
      expect((err as UploadValidationError).status).toBe(400);
    }
  });

  it("mapeia MIME → extensão segura (ignora o nome do arquivo do cliente)", () => {
    const at = (contentType: string) =>
      validatePresignInput({ kind: "document", contentType, size: 10, vehicleId: 1 }, 7).ext;
    expect(at("image/jpeg")).toBe("jpg");
    expect(at("image/png")).toBe("png");
    expect(at("image/webp")).toBe("webp");
    expect(at("application/pdf")).toBe("pdf");
  });
});

describe("validatePresignInput — tamanho", () => {
  it("rejeita acima do limite da foto (8MB) com status 413", () => {
    try {
      validatePresignInput(
        {
          kind: "photo",
          contentType: "image/jpeg",
          size: PHOTO_MAX_BYTES + 1,
          vehicleId: 42,
        },
        7,
      );
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(UploadValidationError);
      expect((err as UploadValidationError).status).toBe(413);
    }
  });

  it("aceita exatamente no limite", () => {
    expect(() =>
      validatePresignInput(
        { kind: "photo", contentType: "image/jpeg", size: PHOTO_MAX_BYTES, vehicleId: 42 },
        7,
      ),
    ).not.toThrow();
  });

  it("limites são por kind — logo (4MB) é mais apertado que hero (8MB)", () => {
    const size = LOGO_MAX_BYTES + 1;
    expect(() =>
      validatePresignInput({ kind: "logo", contentType: "image/png", size }, 7),
    ).toThrow(UploadValidationError);
    expect(() =>
      validatePresignInput({ kind: "hero", contentType: "image/png", size }, 7),
    ).not.toThrow();
  });

  it("documento vai até 20MB", () => {
    expect(() =>
      validatePresignInput(
        { kind: "document", contentType: "application/pdf", size: DOC_MAX_BYTES, vehicleId: 1 },
        7,
      ),
    ).not.toThrow();
    expect(() =>
      validatePresignInput(
        {
          kind: "document",
          contentType: "application/pdf",
          size: DOC_MAX_BYTES + 1,
          vehicleId: 1,
        },
        7,
      ),
    ).toThrow(UploadValidationError);
  });

  it("rejeita tamanho zero ou negativo (assinar ContentLength inválido quebraria o PUT)", () => {
    for (const size of [0, -1]) {
      expect(() =>
        validatePresignInput(
          { kind: "photo", contentType: "image/jpeg", size, vehicleId: 42 },
          7,
        ),
      ).toThrow(UploadValidationError);
    }
  });
});

describe("buildUploadKey — convenção de key", () => {
  it("segue {folder}/{timestamp}-{rand}.{ext}", () => {
    const key = buildUploadKey("tenants/7/vehicles/42", "jpg");
    expect(key).toMatch(/^tenants\/7\/vehicles\/42\/\d+-[a-z0-9]+\.jpg$/);
  });

  it("é exatamente `${Date.now()}-${Math.random().toString(36).slice(2)}`", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const rand = (0.5).toString(36).slice(2);
    expect(buildUploadKey("tenants/7/branding/logo", "png")).toBe(
      `tenants/7/branding/logo/1700000000000-${rand}.png`,
    );
  });
});

describe("publicUrlForKey", () => {
  it("com CDN: `${CDN_URL}/${key}` — mesma forma de lib/s3.ts", () => {
    expect(publicUrlForKey("tenants/7/vehicles/42/123-abc.jpg", CDN)).toBe(
      `${CDN}/tenants/7/vehicles/42/123-abc.jpg`,
    );
  });

  it("tolera CDN_URL com barra final (sem gerar //)", () => {
    expect(publicUrlForKey("a/b.jpg", `${CDN}/`)).toBe(`${CDN}/a/b.jpg`);
  });

  it("sem CDN (dev sem S3): cai no stub local servido por /public", () => {
    expect(publicUrlForKey("tenants/7/vehicles/42/123-abc.jpg", "")).toBe(
      `${LOCAL_URL_PREFIX}/tenants/7/vehicles/42/123-abc.jpg`,
    );
  });
});

describe("assertKeyInFolder — guard das rotas de persistência", () => {
  const folder = "tenants/7/vehicles/42";

  it("aceita key gerada pelo próprio servidor", () => {
    expect(() => assertKeyInFolder(buildUploadKey(folder, "jpg"), folder)).not.toThrow();
  });

  it("recusa key de outro tenant", () => {
    expect(() =>
      assertKeyInFolder("tenants/99/vehicles/42/1-a.jpg", folder),
    ).toThrow(UploadValidationError);
  });

  it("recusa key de outro veículo do mesmo tenant", () => {
    expect(() =>
      assertKeyInFolder("tenants/7/vehicles/43/1-a.jpg", folder),
    ).toThrow(UploadValidationError);
  });

  it("recusa subpasta (docs/ não é foto) e path traversal", () => {
    expect(() => assertKeyInFolder("tenants/7/vehicles/42/docs/1-a.jpg", folder)).toThrow();
    expect(() => assertKeyInFolder("tenants/7/vehicles/42/../43/1-a.jpg", folder)).toThrow();
  });

  it("recusa prefixo que só *parece* o folder", () => {
    expect(() => assertKeyInFolder("tenants/77/vehicles/42/1-a.jpg", folder)).toThrow();
    expect(() => assertKeyInFolder("tenants/7/vehicles/420/1-a.jpg", folder)).toThrow();
  });

  it("recusa extensão fora da allowlist", () => {
    expect(() => assertKeyInFolder(`${folder}/1-a.svg`, folder)).toThrow();
    expect(() => assertKeyInFolder(`${folder}/1-a.html`, folder)).toThrow();
  });
});
