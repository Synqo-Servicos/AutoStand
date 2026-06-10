import { and, desc, eq, getTableColumns, inArray, like, sql } from "drizzle-orm";
import { sellers, transactions, vehicles } from "@/lib/schema";
import type { TransactionRow } from "@/lib/schema";
import type { Transaction, TransactionInput, TransactionWithVehicle } from "@/types/transaction";
import { db } from "./client";
import { computeCommission } from "./sellers";

// — Filters / listing ———————————————————————————————————————————

export interface TransactionFilters {
  vehicle_id?: number;
  type?: string;
  /** Lista de tipos aceitos (OR). Use no lugar de `type` quando filtrar várias. */
  types?: string[];
  /** YYYY-MM */
  month?: string;
  /** YYYY */
  year?: string;
  category?: string;
  seller_id?: number;
  /** Se true, retorna apenas transações sem veículo (despesas operacionais). */
  no_vehicle?: boolean;
}

export async function listTransactions(
  tenantId: number,
  filters: TransactionFilters = {},
): Promise<TransactionWithVehicle[]> {
  const conditions = [eq(transactions.tenant_id, tenantId)];

  if (filters.vehicle_id) conditions.push(eq(transactions.vehicle_id, filters.vehicle_id));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.types && filters.types.length > 0) {
    conditions.push(inArray(transactions.type, filters.types));
  }
  if (filters.year) conditions.push(like(transactions.date, `${filters.year}%`));
  if (filters.month) conditions.push(like(transactions.date, `${filters.month}%`));
  if (filters.category) conditions.push(eq(transactions.category, filters.category));
  if (filters.seller_id) conditions.push(eq(transactions.seller_id, filters.seller_id));
  if (filters.no_vehicle) conditions.push(sql`${transactions.vehicle_id} IS NULL`);

  // LEFT JOIN para incluir despesas operacionais (sem veículo).
  const rows = await db
    .select({
      ...getTableColumns(transactions),
      vehicle_brand: vehicles.brand,
      vehicle_model: vehicles.model,
      vehicle_year: vehicles.year,
    })
    .from(transactions)
    .leftJoin(vehicles, eq(vehicles.id, transactions.vehicle_id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.created_at));

  return rows as TransactionWithVehicle[];
}

/** Despesas diretas registradas para um veículo (categoria de gasto interna). */
export async function getDirectExpensesByVehicle(
  tenantId: number,
  vehicleId: number,
): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.tenant_id, tenantId),
        eq(transactions.vehicle_id, vehicleId),
        eq(transactions.type, "despesa_direta"),
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.created_at));
  return rows as Transaction[];
}

export async function getTransaction(
  tenantId: number,
  id: number,
): Promise<TransactionRow | null> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createTransaction(
  tenantId: number,
  input: TransactionInput,
): Promise<TransactionRow> {
  // Defesa em profundidade: vehicle_id e seller_id vêm do body do request
  // e poderiam apontar pra entidades de outro tenant (insert mantém o
  // tenant_id correto, mas a FK ficaria cross-tenant — pollution de DB).
  // Validamos antes de qualquer escrita.
  if (input.vehicle_id) {
    const [v] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, input.vehicle_id)))
      .limit(1);
    if (!v) throw new Error("Veículo não encontrado neste tenant");
  }
  if (input.seller_id) {
    const [s] = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(and(eq(sellers.tenant_id, tenantId), eq(sellers.id, input.seller_id)))
      .limit(1);
    if (!s) throw new Error("Vendedor não encontrado neste tenant");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({
        tenant_id: tenantId,
        vehicle_id: input.vehicle_id,
        type: input.type,
        amount: input.amount,
        date: input.date,
        category: input.category ?? null,
        seller_id: input.seller_id ?? null,
        buyer_name: input.buyer_name,
        buyer_phone: input.buyer_phone,
        notes: input.notes,
      })
      .returning();

    // 'entrada' (compra) e 'saida' (venda) também atualizam o status do veículo.
    if ((input.type === "saida" || input.type === "entrada") && input.vehicle_id) {
      const newStatus = input.type === "saida" ? "vendido" : "disponivel";
      await tx
        .update(vehicles)
        .set({ status: newStatus, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(vehicles.tenant_id, tenantId), eq(vehicles.id, input.vehicle_id)));
    }

    // Venda com vendedor configurado → cria comissão automática como
    // transação derivada (mesma data, referenciando o mesmo veículo).
    if (input.type === "saida" && input.seller_id) {
      const [seller] = await tx
        .select({
          commission_pct: sellers.commission_pct,
          commission_fixed_cents: sellers.commission_fixed_cents,
        })
        .from(sellers)
        .where(and(eq(sellers.tenant_id, tenantId), eq(sellers.id, input.seller_id)))
        .limit(1);
      if (seller) {
        const commissionAmount = computeCommission(input.amount, seller);
        if (commissionAmount > 0) {
          await tx.insert(transactions).values({
            tenant_id: tenantId,
            vehicle_id: input.vehicle_id,
            type: "comissao",
            amount: commissionAmount,
            date: input.date,
            category: "Comissão de venda",
            seller_id: input.seller_id,
            buyer_name: null,
            buyer_phone: null,
            notes: `Comissão automática da venda #${row.id}`,
          });
        }
      }
    }

    return row;
  });
}

const TRANSACTION_UPDATE_FIELDS = [
  "amount", "date", "buyer_name", "buyer_phone", "notes", "category", "seller_id",
] as const;

export async function updateTransaction(
  tenantId: number,
  id: number,
  input: Partial<TransactionInput>,
): Promise<TransactionRow | null> {
  const safe: Record<string, unknown> = {};
  for (const key of TRANSACTION_UPDATE_FIELDS) {
    if (key in input) safe[key] = input[key];
  }
  if (Object.keys(safe).length > 0) {
    await db
      .update(transactions)
      .set(safe)
      .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)));
  }
  return getTransaction(tenantId, id);
}

export async function deleteTransaction(tenantId: number, id: number): Promise<void> {
  await db
    .delete(transactions)
    .where(and(eq(transactions.tenant_id, tenantId), eq(transactions.id, id)));
}

// — Financeiro (relatórios sobre transactions) ———————————————————

export interface FinanceiroResumo {
  receita: number;
  custos: number;        // soma de cost_price das vendas
  despesasDir: number;   // despesas diretas
  despesasOp: number;    // fixa + var + comissao
  lucroBruto: number;    // receita - custos
  lucroLiquido: number;  // lucroBruto - despesasDir - despesasOp
  vendasUnits: number;
}

export interface FinanceiroPorVeiculoRow {
  vehicle_id: number;
  brand: string;
  model: string;
  year: number;
  sale_date: string;
  receita: number;
  custo: number;
  despesas_diretas: number;
  margem_real: number;
}

export interface OperationalExpenseRow {
  id: number;
  type: string;
  category: string | null;
  amount: number;
  date: string;
  notes: string | null;
  seller_id: number | null;
}

/** Filtros de período do financeiro: `month` (YYYY-MM) ou `year` (YYYY). */
export interface FinanceiroFilters {
  month?: string;
  year?: string;
}

function periodWhere(filters: FinanceiroFilters): string {
  if (filters.month) return filters.month;
  if (filters.year) return filters.year;
  return ""; // tudo
}

export async function getFinanceiroResumo(
  tenantId: number,
  filters: FinanceiroFilters = {},
): Promise<FinanceiroResumo> {
  const period = periodWhere(filters);
  const likePattern = period ? `${period}%` : "%";

  const [vendas, despesasDir, despesasOp] = await Promise.all([
    db.get(sql`
      SELECT
        COALESCE(SUM(t.amount), 0)        AS receita,
        COALESCE(SUM(v.cost_price), 0)    AS custos,
        COUNT(*)                          AS units
      FROM transactions t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.tenant_id = ${tenantId}
        AND t.type      = 'saida'
        AND t.date LIKE ${likePattern}
    `) as Promise<{ receita: number; custos: number; units: number }>,
    db.get(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE tenant_id = ${tenantId}
        AND type      = 'despesa_direta'
        AND date LIKE ${likePattern}
    `) as Promise<{ total: number }>,
    db.get(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE tenant_id = ${tenantId}
        AND type IN ('despesa_fixa', 'despesa_var', 'comissao')
        AND date LIKE ${likePattern}
    `) as Promise<{ total: number }>,
  ]);

  const lucroBruto = vendas.receita - vendas.custos;
  const lucroLiquido = lucroBruto - despesasDir.total - despesasOp.total;

  return {
    receita: vendas.receita,
    custos: vendas.custos,
    despesasDir: despesasDir.total,
    despesasOp: despesasOp.total,
    lucroBruto,
    lucroLiquido,
    vendasUnits: vendas.units,
  };
}

export async function getFinanceiroPorVeiculo(
  tenantId: number,
  filters: FinanceiroFilters = {},
): Promise<FinanceiroPorVeiculoRow[]> {
  const period = periodWhere(filters);
  const likePattern = period ? `${period}%` : "%";

  return (await db.all(sql`
    SELECT
      v.id                          AS vehicle_id,
      v.brand                       AS brand,
      v.model                       AS model,
      v.year                        AS year,
      t.date                        AS sale_date,
      t.amount                      AS receita,
      v.cost_price                  AS custo,
      COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE tenant_id = ${tenantId}
          AND vehicle_id = v.id
          AND type = 'despesa_direta'
      ), 0)                         AS despesas_diretas,
      (t.amount - v.cost_price - COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE tenant_id = ${tenantId}
          AND vehicle_id = v.id
          AND type = 'despesa_direta'
      ), 0))                        AS margem_real
    FROM transactions t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.tenant_id = ${tenantId}
      AND t.type      = 'saida'
      AND t.date LIKE ${likePattern}
    ORDER BY t.date DESC
  `)) as FinanceiroPorVeiculoRow[];
}

export async function getOperationalExpenses(
  tenantId: number,
  filters: FinanceiroFilters = {},
): Promise<OperationalExpenseRow[]> {
  const period = periodWhere(filters);
  const likePattern = period ? `${period}%` : "%";

  return (await db.all(sql`
    SELECT id, type, category, amount, date, notes, seller_id
    FROM transactions
    WHERE tenant_id = ${tenantId}
      AND type IN ('despesa_fixa', 'despesa_var', 'comissao')
      AND date LIKE ${likePattern}
    ORDER BY date DESC, created_at DESC
  `)) as OperationalExpenseRow[];
}
