import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

// Hash bcrypt (cost 12) usado só para equalizar o tempo de resposta quando
// o e-mail não tem conta — roda um compare "de mentira" para o timing não
// revelar quais e-mails existem. O texto em claro é irrelevante; nenhuma
// senha real bate com ele.
const TIMING_EQUALIZER_HASH =
  "$2a$12$mvenv.mQmd87gcnFxDdOC.xi8skthvlvW7UvnryDTh1Ufb2/zBG6e";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Em multi-tenant (loja.autostand.com.br, console.autostand.com.br),
  // o origin varia por request. Sem trustHost, NextAuth v5 usa AUTH_URL
  // (fixo) como base canônica e o callback após login sai pro host
  // errado — quebrava o login no painel da loja em dev.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Anti-brute-force: limita tentativas por IP+email. Best-effort —
        // se o Upstash não estiver configurado, vira no-op (ver lib/ratelimit).
        const ip = getClientIp(request);
        const rl = await checkRateLimit("login", `${ip}:${email.toLowerCase()}`);
        if (!rl.ok) return null;

        const user = await getUserByEmail(email);
        // Sempre roda um bcrypt.compare — contra a senha real ou um hash
        // dummy — para o tempo de resposta não revelar se o e-mail tem conta.
        const valid = await bcrypt.compare(password, user?.password ?? TIMING_EQUALIZER_HASH);
        if (!user || !valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          tenantId: user.tenant_id ?? null,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  // JWT expira em 8h em vez do default de 30 dias — limita janela de
  // exploração de um token roubado e força revalidação periódica.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  jwt:     { maxAge: 60 * 60 * 8 },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId ?? null;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = (token.tenantId as number | null) ?? null;
        session.user.role = (token.role as string) ?? "tenant_admin";
      }
      return session;
    },
  },
});

/**
 * Resolves the acting tenant for an authenticated API route.
 * Returns the tenant id, or null when there is no valid tenant session.
 */
export async function getApiTenantId(): Promise<number | null> {
  const session = await auth();
  return session?.user?.tenantId ?? null;
}

/** True when the current session belongs to a platform super-admin. */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "super_admin";
}

/** Id do usuário autenticado (para atribuir autoria de ações), ou null. */
export async function getApiUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}
