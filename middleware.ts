import { NextRequest, NextResponse } from "next/server";

const PLATFORM_HOSTS = (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1,app.localhost")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isConsoleHost(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (!bare.startsWith("console.")) return false;
  return PLATFORM_HOSTS.includes(bare.slice("console.".length));
}

function isLocalHost(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  return bare === "localhost" || bare === "127.0.0.1" || bare.endsWith(".localhost");
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (
    isConsoleHost(host) &&
    !pathname.startsWith("/superadmin") &&
    !pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/superadmin/login";
    return NextResponse.redirect(url);
  }

  // Atrás do CloudFront→ALB, o Next.js standalone reescreve o
  // `x-forwarded-host` com o hostname interno do container ECS
  // (ex.: ip-172-31-11-41.sa-east-1.compute.internal:3000). O Auth.js
  // monta as URLs de redirect a partir de `x-forwarded-host ?? host`,
  // então o login saía para esse host interno. O header `host` original
  // chega correto (a resolução de tenant depende dele), então o tornamos
  // a fonte de verdade para downstream (Auth.js e demais URLs absolutas).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-forwarded-host", host);
  requestHeaders.set("x-forwarded-proto", isLocalHost(host) ? "http" : "https");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png).*)"],
};
