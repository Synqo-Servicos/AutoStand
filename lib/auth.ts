import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await getUserByEmail(credentials.email as string);
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
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
