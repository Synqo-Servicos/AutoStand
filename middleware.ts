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

  // CloudFront→ALB falam HTTP (porta 80) com a origem, então o
  // `x-forwarded-proto` chega como "http" e o Auth.js emitia os cookies
  // de sessão sem a flag Secure. Normalizamos para "https" (o esquema
  // público) para que os cookies usem o prefixo `__Secure-`.
  //
  // Obs.: o `x-forwarded-host` NÃO pode ser corrigido aqui — o Next.js
  // standalone o reescreve com o hostname interno do container (ECS)
  // depois do middleware. Por isso o redirect de login é resolvido no
  // cliente (`redirect: false`), ver app/admin/login/LoginForm.tsx.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-forwarded-proto", isLocalHost(host) ? "http" : "https");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png).*)"],
};
