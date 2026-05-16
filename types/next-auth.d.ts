import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Tenant the user belongs to. Null for super_admin. */
      tenantId: number | null;
      /** 'super_admin' | 'tenant_admin' */
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: number | null;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: number | null;
    role?: string;
  }
}
