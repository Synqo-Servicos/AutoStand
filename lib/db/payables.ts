import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "./client";
import {
  payable_attachments, payables, transactions,
  type PayableAttachmentRow, type PayableRow,
} from "@/lib/schema";
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

/**
 * Allowlist dos campos graváveis — mesmo padrão de
 * pickWritableTenantFields/pickCreatableTenantFields em lib/db/tenants.ts.
 * `tenant_id` e `id` NUNCA aparecem aqui: bloqueia mass-assignment no dia em
 * que uma rota HTTP passar um body de requisição adiante sem filtrar.
 */
const PAYABLE_CREATE_FIELDS = [
  "type", "category", "description", "supplier", "amount_cents",
  "frequency", "first_due_date", "installments", "payment_method", "notes",
] as const;

/** Update aceita tudo que create aceita, mais `active` (encerrar a conta). */
const PAYABLE_WRITABLE_FIELDS = [...PAYABLE_CREATE_FIELDS, "active"] as const;

// `PayableInput` é uma interface escrita à mão, não um tipo mapeado (ao
// contrário de `NewTenant`, que vem de `$inferInsert`) — TS não infere
// índice de string implícito pra ela, então o generic constraint
// `T extends Record<string, unknown>` de tenants.ts não compila aqui. Em
// vez disso, `pickFields` opera em `Record<string, unknown>` sem generics
// e os dois wrappers tipados fazem a conversão pela borda (`unknown`
// primeiro, como o próprio compilador sugere).
function pickFields(
  input: Record<string, unknown>,
  allow: readonly string[],
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of allow) {
    if (key in input) safe[key] = input[key];
  }
  return safe;
}

/** Filtra input p/ os campos aceitos na CRIAÇÃO. */
function pickCreatablePayableFields(input: PayableInput): PayableInput {
  return pickFields(input as unknown as Record<string, unknown>, PAYABLE_CREATE_FIELDS) as unknown as PayableInput;
}

/** Filtra input p/ os campos graváveis num UPDATE. */
function pickWritablePayableFields(
  input: Partial<PayableInput> & { active?: boolean },
): Partial<PayableInput> & { active?: boolean } {
  return pickFields(input as unknown as Record<string, unknown>, PAYABLE_WRITABLE_FIELDS) as unknown as Partial<PayableInput> & { active?: boolean };
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
  const safe = pickCreatablePayableFields(input);
  const [row] = await db.insert(payables).values({ ...safe, tenant_id: tenantId }).returning();
  return row;
}

/** `active: false` é a única forma de encerrar uma conta — não há delete. */
export async function updatePayable(
  tenantId: number,
  id: number,
  input: Partial<PayableInput> & { active?: boolean },
): Promise<PayableRow | null> {
  const safe = pickWritablePayableFields(input);
  if (Object.keys(safe).length > 0) {
    await db.update(payables).set(safe)
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

/** Boleto (transaction_id nulo) e comprovantes de uma conta, mais antigos primeiro. */
export async function listPayableAttachments(
  tenantId: number, payableId: number,
): Promise<PayableAttachmentRow[]> {
  return db.select().from(payable_attachments)
    .where(and(
      eq(payable_attachments.tenant_id, tenantId),
      eq(payable_attachments.payable_id, payableId),
    ))
    .orderBy(payable_attachments.created_at);
}

export async function addPayableAttachment(
  tenantId: number,
  payableId: number,
  input: {
    name: string; url: string; size: number | null;
    mime_type: string | null; transaction_id: number | null; uploaded_by: number | null;
  },
): Promise<PayableAttachmentRow> {
  const [row] = await db.insert(payable_attachments)
    .values({ tenant_id: tenantId, payable_id: payableId, ...input })
    .returning();
  return row;
}

/** Tenant-scoped: só apaga a linha se o anexo for deste tenant. */
export async function deletePayableAttachment(
  tenantId: number, attachmentId: number,
): Promise<PayableAttachmentRow | null> {
  const [row] = await db.delete(payable_attachments)
    .where(and(
      eq(payable_attachments.tenant_id, tenantId),
      eq(payable_attachments.id, attachmentId),
    ))
    .returning();
  return row ?? null;
}
