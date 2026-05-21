/**
 * Consulta de dados do veículo a partir da placa (Mercosul ou antiga).
 *
 * Provider atual: ApiBrasil (gateway.apibrasil.io). 100 consultas/dia grátis.
 * https://docs.apibrasil.com.br
 *
 * **Privacidade (LGPD):**
 *  - Esta função IGNORA qualquer dado pessoal/sensível que a API porventura
 *    devolver: nome do proprietário, CPF, endereço, Renavam, débitos,
 *    multas, restrições de gravame/leilão. Só passamos adiante atributos
 *    técnicos do veículo, que constam do CRLV e da tabela FIPE — informações
 *    de natureza pública.
 *  - O retorno bruto da API NÃO é persistido nem ecoado pra UI; só a forma
 *    canônica abaixo (VehicleLookupResult).
 */

export interface VehicleLookupResult {
  /** Placa normalizada (sem traço, maiúscula). */
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  /** Ano modelo. */
  year: number | null;
  /** Ano de fabricação. */
  year_manufacture: number | null;
  color: string | null;
  /** Normalizado para 'flex' | 'gasolina' | 'etanol' | 'diesel' | 'eletrico' | 'hibrido' | null. */
  fuel: string | null;
  fipe_code: string | null;
  /** Sugestão de preço de venda — vem da FIPE em centavos. */
  fipe_value_cents: number | null;
  /** Mês de referência da FIPE (texto). */
  fipe_reference: string | null;
  /** True quando o resultado veio de uma fonte mock (modo DEMO). */
  isDemo: boolean;
}

export type LookupStatus =
  | { ok: true; data: VehicleLookupResult }
  | { ok: false; reason: "not_configured" | "not_found" | "rate_limited" | "error"; message: string };

const FUEL_MAP: Record<string, string> = {
  GASOLINA: "gasolina",
  ETANOL: "etanol",
  ALCOOL: "etanol",
  FLEX: "flex",
  "ALCOOL/GASOLINA": "flex",
  "GASOLINA/ALCOOL": "flex",
  DIESEL: "diesel",
  ELETRICO: "eletrico",
  HIBRIDO: "hibrido",
};

function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function normalizeFuel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toUpperCase().trim().replace(/\s+/g, " ");
  return FUEL_MAP[key] ?? raw.toLowerCase();
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseInt(v.replace(/\D/g, ""), 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Centavos a partir de "R$ 35.000,00" ou "35000" ou 35000.5. */
function brlToCents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100);
  const cleaned = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Mapeia o payload do ApiBrasil para a forma canônica.
 * Apenas campos seguros. Tudo que não estiver listado aqui é descartado.
 */
function mapApiBrasil(plate: string, payload: Record<string, unknown>): VehicleLookupResult | null {
  // O envelope pode vir como { response: {...} } ou direto.
  const r = (payload.response ?? payload) as Record<string, unknown>;
  if (!r || typeof r !== "object") return null;

  const extra = (r.extra ?? {}) as Record<string, unknown>;
  const fipe = (r.fipe ?? {}) as Record<string, unknown>;
  const fipeList = (Array.isArray(fipe.dados) ? fipe.dados : fipe) as Array<Record<string, unknown>>;
  const fipeFirst = Array.isArray(fipeList) ? fipeList[0] : null;

  const brand =
    (r.MARCA as string | undefined) ??
    (r.marca as string | undefined) ??
    null;
  const model =
    (r.MODELO as string | undefined) ??
    (r.modelo as string | undefined) ??
    null;
  const version =
    (r.VERSAO as string | undefined) ??
    (r.SUBMODELO as string | undefined) ??
    (r.submodelo as string | undefined) ??
    null;
  const year = toNumber(r.anoModelo ?? r.ano_modelo);
  const yearManuf = toNumber(r.ano);
  const color = (r.cor as string | undefined) ?? null;
  const fuel = normalizeFuel(
    (extra.combustivel as string | undefined) ??
      (fipeFirst?.combustivel as string | undefined),
  );
  const fipeCode = (fipeFirst?.codigo_fipe as string | undefined) ?? null;
  const fipeValue = brlToCents(fipeFirst?.valor ?? fipeFirst?.texto_valor);
  const fipeReference = (fipeFirst?.mes_referencia as string | undefined) ?? null;

  return {
    plate,
    brand: brand ? titleCase(brand) : null,
    model: model ? titleCase(model) : null,
    version: version || null,
    year,
    year_manufacture: yearManuf,
    color: color ? titleCase(color) : null,
    fuel,
    fipe_code: fipeCode,
    fipe_value_cents: fipeValue,
    fipe_reference: fipeReference,
    isDemo: false,
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Resposta de demonstração — usada quando DEMO_PLACA_API=true e ainda não há
 * chave real configurada. Não vaza dados pessoais: é tudo fictício.
 */
function demoResult(plate: string): VehicleLookupResult {
  // Variação leve por checksum da placa pra parecer "buscado de verdade".
  const sum = [...plate].reduce((a, c) => a + c.charCodeAt(0), 0);
  const samples = [
    {
      brand: "Hyundai", model: "HB20S", version: "1.0 Turbo Platinum Plus",
      year: 2022, year_manufacture: 2021, color: "Vermelho", fuel: "flex",
      fipe_code: "015205-6", fipe_value_cents: 73_900_00, fipe_reference: "abril de 2026",
    },
    {
      brand: "Volkswagen", model: "Polo", version: "1.0 200 TSI Highline",
      year: 2023, year_manufacture: 2022, color: "Azul", fuel: "flex",
      fipe_code: "005506-9", fipe_value_cents: 97_900_00, fipe_reference: "abril de 2026",
    },
    {
      brand: "Jeep", model: "Compass", version: "1.3 T270 Limited",
      year: 2022, year_manufacture: 2022, color: "Branco", fuel: "flex",
      fipe_code: "017070-4", fipe_value_cents: 129_900_00, fipe_reference: "abril de 2026",
    },
    {
      brand: "Chevrolet", model: "Onix Plus", version: "1.0 Turbo Premier II",
      year: 2022, year_manufacture: 2022, color: "Prata", fuel: "flex",
      fipe_code: "004538-9", fipe_value_cents: 79_900_00, fipe_reference: "abril de 2026",
    },
  ];
  const pick = samples[sum % samples.length];
  return { plate, isDemo: true, ...pick };
}

export async function lookupVehicleByPlate(rawPlate: string): Promise<LookupStatus> {
  const plate = normalizePlate(rawPlate);
  if (plate.length !== 7) {
    return { ok: false, reason: "error", message: "Formato de placa inválido (precisa de 7 caracteres)." };
  }

  // Modo demo: usado em desenvolvimento e na vitrine de apresentação enquanto
  // a chave real não estiver configurada.
  if (process.env.DEMO_PLACA_API === "true") {
    return { ok: true, data: demoResult(plate) };
  }

  const bearerToken = process.env.APIBRASIL_BEARER_TOKEN;
  const deviceToken = process.env.APIBRASIL_DEVICE_TOKEN;
  if (!bearerToken || !deviceToken) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Consulta automática indisponível. Configure APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN no Vercel.",
    };
  }

  try {
    const res = await fetch("https://gateway.apibrasil.io/api/v2/vehicles/dados", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        DeviceToken: deviceToken,
      },
      body: JSON.stringify({ placa: plate }),
    });

    if (res.status === 429) {
      return { ok: false, reason: "rate_limited", message: "Limite da API excedido. Tente novamente em alguns minutos." };
    }
    if (res.status === 404) {
      return { ok: false, reason: "not_found", message: "Placa não encontrada na base." };
    }
    if (!res.ok) {
      return { ok: false, reason: "error", message: `Erro da API (HTTP ${res.status}).` };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const data = mapApiBrasil(plate, payload);
    if (!data) {
      return { ok: false, reason: "not_found", message: "API respondeu sem dados utilizáveis." };
    }
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Falha de rede ao consultar a placa.",
    };
  }
}
