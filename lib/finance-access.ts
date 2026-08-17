import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

/**
 * Acesso ao financeiro da plataforma — o único ponto do console onde o
 * papel `contador` entra.
 *
 * A regra é **deny por padrão**, e ela é estrutural, não por lembrança:
 *
 * - `withSuperAdmin` (lib/api.ts) continua significando super-admin e mais
 *   ninguém. Não ganha exceção nem parâmetro.
 * - As páginas do console seguem gateadas pelo layout de
 *   `app/superadmin/(panel)`, que também não muda. O financeiro mora em
 *   `app/superadmin/(financeiro)`, com layout próprio.
 *
 * Consequência: rota ou página nova nasce **fechada** ao contador. Abrir
 * para ele exige escolher explicitamente `withFinanceAccess` (rota) ou o
 * route group `(financeiro)` (página). O modo de falha por esquecimento é
 * negar acesso, não conceder — reclamação de acesso é bug visível e barato;
 * o inverso é vazamento silencioso.
 */

/** Papéis com acesso ao financeiro. Conjunto fechado, de propósito. */
const FINANCE_ROLES: ReadonlySet<string> = new Set(["super_admin", "contador"]);

/**
 * Predicado único de acesso ao financeiro — usado pelo layout de
 * `(financeiro)` e por `withFinanceAccess`, para que página e rota não
 * possam divergir.
 */
export function hasFinanceAccess(role: string | null | undefined): boolean {
  return typeof role === "string" && FINANCE_ROLES.has(role);
}

type RouteCtx<P extends Record<string, string>> = { params: Promise<P> };

type FinanceHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: {
    userId: number;
    params: P;
  },
) => Promise<Response> | Response;

/**
 * Espelha `withSuperAdmin` (lib/api.ts) trocando **apenas** o predicado de
 * papel. Usar somente nas rotas do financeiro.
 */
export function withFinanceAccess<P extends Record<string, string> = Record<string, string>>(
  handler: FinanceHandler<P>,
) {
  return async (req: NextRequest, routeCtx: RouteCtx<P>) => {
    const session = await auth().catch(() => null);
    const user = session?.user;
    if (!user || !hasFinanceAccess(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = await routeCtx.params;
    try {
      return await handler(req, {
        userId: Number(user.id),
        params,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * Cópia do `toErrorResponse` de lib/api.ts, que é privado do módulo.
 * Duplicado de propósito: esta task não toca lib/api.ts — que o wrapper
 * padrão fique intocado é o desenho. Se um dia aquele helper for
 * exportado, esta função vira um import.
 */
function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.length ? first.path.join(".") : "body";
    return NextResponse.json(
      { error: `${path}: ${first?.message ?? "Dados inválidos."}` },
      { status: 400 },
    );
  }
  console.error("[api] uncaught:", err);
  const message = err instanceof Error ? err.message : "Erro interno do servidor.";
  return NextResponse.json({ error: message }, { status: 500 });
}
