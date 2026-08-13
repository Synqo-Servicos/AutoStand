import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "./client";
import { payables, transactions, type PayableRow } from "@/lib/schema";
import {
  buildBills, defaultWindow,
  type Bill, type PaidRef, type PayableRule,
} from "@/lib/recurring";

export interface BillWithPayable extends Bill {
  type: string;
  category: string | null;
  description: string | null;
  supplier: string | null;
  payment_method: string | null;
}

export interface PayableInput {
  type: string;
  category: string | null;
  description: string | null;
  supplier: string | null;
  amount_cents: number | null;
  frequency: string;
  first_due_date: string;
  installments: number | null;
  payment_method: string | null;
  notes: string | null;
}

export async function listPayables(
  tenantId: number,
  opts: { includeInactive?: boolean } = {},
): Promise<PayableRow[]> {
  const where = opts.includeInactive
    ? eq(payables.tenant_id, tenantId)
    : and(eq(payables.tenant_id, tenantId), eq(payables.active, true));
  return db.select().from(payables).where(where).orderBy(payables.first_due_date);
}

export async function getPayable(tenantId: number, id: number): Promise<PayableRow | null> {
  const [row] = await db
    .select().from(payables)
    .where(and(eq(payables.tenant_id, tenantId), eq(payables.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * Contas da janela padrão, já classificadas. Duas queries; a expansão e a
 * classificação ficam no módulo puro (lib/recurring.ts).
 */
export async function listBills(tenantId: number, today: string): Promise<BillWithPayable[]> {
  const window = defaultWindow(today);
  const rules = await listPayables(tenantId);
  if (rules.length === 0) return [];

  const paidRows = await db
    .select({
      payable_id: transactions.payable_id,
      due_date: transactions.due_date,
      transaction_id: transactions.id,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(
      eq(transactions.tenant_id, tenantId),
      isNotNull(transactions.payable_id),
      gte(transactions.due_date, window.from),
      lte(transactions.due_date, window.to),
    ))
    .orderBy(transactions.due_date);

  const paid = paidRows as PaidRef[];
  const byId = new Map(rules.map((r) => [r.id, r]));
  const asRules: PayableRule[] = rules.map((r) => ({
    id: r.id,
    frequency: r.frequency,
    first_due_date: r.first_due_date,
    installments: r.installments,
    payment_method: r.payment_method,
    amount_cents: r.amount_cents,
  }));

  return buildBills(asRules, paid, window, today).map((b): BillWithPayable => {
    const p = byId.get(b.payable_id)!;
    return {
      ...b,
      type: p.type,
      category: p.category,
      description: p.description,
      supplier: p.supplier,
      payment_method: p.payment_method,
    };
  });
}

export async function createPayable(tenantId: number, input: PayableInput): Promise<PayableRow> {
  const [row] = await db.insert(payables).values({ tenant_id: tenantId, ...input }).returning();
  return row;
}

/** `active: false` é a única forma de encerrar uma conta — não há delete. */
export async function updatePayable(
  tenantId: number,
  id: number,
  input: Partial<PayableInput> & { active?: boolean },
): Promise<PayableRow | null> {
  if (Object.keys(input).length > 0) {
    await db.update(payables).set(input)
      .where(and(eq(payables.tenant_id, tenantId), eq(payables.id, id)));
  }
  return getPayable(tenantId, id);
}

/** Trava de duplicata: já existe transação para este par (regra, vencimento)? */
export async function hasPaymentFor(
  tenantId: number, payableId: number, dueDate: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(
      eq(transactions.tenant_id, tenantId),
      eq(transactions.payable_id, payableId),
      eq(transactions.due_date, dueDate),
    ))
    .limit(1);
  return !!row;
}

/** Alimenta o badge da sidebar e o banner do dashboard. */
export async function countOverdue(tenantId: number, today: string): Promise<number> {
  const bills = await listBills(tenantId, today);
  return bills.filter((b) => b.status === "atrasado").length;
}
