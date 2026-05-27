/**
 * Barrel da camada de dados — agrupa os módulos por domínio em
 * lib/db/*.ts. Mantém o `@/lib/db` como import único pra não obrigar
 * cada caller a saber em qual módulo cada função vive.
 *
 * Convenção: toda função tenant-scoped recebe `tenantId: number` como
 * primeiro argumento e filtra todas as queries por ele. A exceção
 * sancionada é o marketplace (lib/marketplace.ts), que lê cross-tenant.
 */

export { db, client } from "./client";

export * from "./tenants";
export * from "./users";
export * from "./vehicles";
export * from "./sellers";
export * from "./transactions";
export * from "./leads";
export * from "./dashboard";
export * from "./partners";
