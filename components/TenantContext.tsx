"use client";

import { createContext, useContext } from "react";
import type { TenantRow } from "@/lib/schema";

const TenantCtx = createContext<TenantRow | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantRow;
  children: React.ReactNode;
}) {
  return <TenantCtx.Provider value={tenant}>{children}</TenantCtx.Provider>;
}

/** Tenant of the current storefront. Throws if used outside <TenantProvider>. */
export function useTenant(): TenantRow {
  const tenant = useContext(TenantCtx);
  if (!tenant) throw new Error("useTenant precisa estar dentro de <TenantProvider>");
  return tenant;
}

/** Two-letter brand mark derived from the tenant name. */
export function tenantInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
