import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { auth, getApiTenantId } from "@/lib/auth";

/**
 * Wrappers de rota — centralizam autenticação, parsing de params,
 * tratamento de erro e validação de body com zod. O objetivo é trocar
 * 4-5 linhas de boilerplate no topo de cada handler por um wrap único
 * + handler com tenantId/sessão já injetados.
 *
 * Exemplo:
 *
 *   export const POST = withTenant<{ id: string }>(async (req, { tenantId, params }) => {
 *     const body = await parseBody(req, vehicleInputSchema);
 *     const v = await createVehicle(tenantId, body);
 *     return NextResponse.json(v, { status: 201 });
 *   });
 */

/** Erro tipado que o wrapper converte em resposta JSON com status correto. */
export class ApiError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "ApiError";
  }
}

type RouteCtx<P extends Record<string, string>> = { params: Promise<P> };

type TenantHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: { tenantId: number; params: P },
) => Promise<Response> | Response;

type SuperAdminHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: {
    userId: number;
    params: P;
  },
) => Promise<Response> | Response;

export function withTenant<P extends Record<string, string> = Record<string, string>>(
  handler: TenantHandler<P>,
) {
  return async (req: NextRequest, routeCtx: RouteCtx<P>) => {
    const tenantId = await getApiTenantId();
    if (tenantId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = await routeCtx.params;
    try {
      return await handler(req, { tenantId, params });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function withSuperAdmin<P extends Record<string, string> = Record<string, string>>(
  handler: SuperAdminHandler<P>,
) {
  return async (req: NextRequest, routeCtx: RouteCtx<P>) => {
    const session = await auth().catch(() => null);
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = await routeCtx.params;
    try {
      return await handler(req, {
        userId: session.user.id ? Number(session.user.id) : 0,
        params,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * Lê o body JSON do request e valida contra um schema zod. Lança
 * ApiError(400) se o body for inválido — o wrapper captura.
 */
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Body inválido — JSON esperado.", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length ? first.path.join(".") : "body";
    throw new ApiError(`${path}: ${first.message}`, 400);
  }
  return result.data;
}

/** Lê um inteiro positivo de um SearchParams, ou null. Throws em formato errado. */
export function intParam(sp: URLSearchParams, key: string): number | null {
  const raw = sp.get(key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ApiError(`Parâmetro ${key} inválido: esperado inteiro positivo.`);
  }
  return n;
}

function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // Validação zod feita via `.parse()` direto no handler (sem parseBody) —
  // converte pra 400 com a primeira issue, em vez de vazar como 500.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.length ? first.path.join(".") : "body";
    return NextResponse.json(
      { error: `${path}: ${first?.message ?? "Dados inválidos."}` },
      { status: 400 },
    );
  }
  // Erro inesperado — logar pra Vercel + responder genérico.
  console.error("[api] uncaught:", err);
  const message = err instanceof Error ? err.message : "Erro interno do servidor.";
  return NextResponse.json({ error: message }, { status: 500 });
}
