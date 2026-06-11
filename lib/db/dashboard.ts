import { sql } from "drizzle-orm";
import type { DashboardStats, MonthlyData, StockByStatus } from "@/types/dashboard";
import { db, dbAll, dbGet } from "./client";

/**
 * KPIs do dashboard admin (single tenant). Cinco queries paralelizáveis,
 * cada uma agregando uma janela específica (mês corrente vs histórico).
 * Cross-table (vehicles + transactions) — fica aqui em vez de em
 * vehicles.ts/transactions.ts porque o agregado é o conceito.
 */
export async function getDashboardStats(tenantId: number): Promise<DashboardStats> {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const stockByStatus = (await dbAll(sql`
    SELECT status, COUNT(*) as count
    FROM vehicles
    WHERE tenant_id = ${tenantId}
    GROUP BY status
  `)) as StockByStatus[];

  const monthlySales = (await dbGet(sql`
    SELECT COUNT(*) as units, COALESCE(SUM(amount), 0) as revenue
    FROM transactions
    WHERE tenant_id = ${tenantId} AND type = 'saida' AND date LIKE ${`${monthStr}%`}
  `)) as { units: number; revenue: number };

  const totalCostValue = (await dbGet(sql`
    SELECT COALESCE(SUM(cost_price), 0) as total
    FROM vehicles
    WHERE tenant_id = ${tenantId} AND status != 'vendido'
  `)) as { total: number };

  const monthlyProfit = (await dbGet(sql`
    SELECT COALESCE(SUM(t.amount - v.cost_price), 0) as profit
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.tenant_id = ${tenantId} AND t.type = 'saida' AND t.date LIKE ${`${monthStr}%`}
  `)) as { profit: number };

  const monthly = (await dbAll(sql`
    SELECT left(t.date, 7) as month,
           SUM(t.amount) as revenue,
           SUM(t.amount - v.cost_price) as profit,
           COUNT(*) as units
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.tenant_id = ${tenantId} AND t.type = 'saida'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `)) as MonthlyData[];

  return {
    stockByStatus,
    monthlySales: { units: monthlySales?.units ?? 0, revenue: monthlySales?.revenue ?? 0 },
    totalCostValue: totalCostValue?.total ?? 0,
    monthlyProfit: monthlyProfit?.profit ?? 0,
    monthly,
  };
}
