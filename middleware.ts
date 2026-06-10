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
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png).*)"],
};
