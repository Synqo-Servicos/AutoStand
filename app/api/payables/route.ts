import { NextResponse } from "next/server";
import { createPayable, listBills } from "@/lib/db";
import { parseBody, withTenant } from "@/lib/api";
import { payableInputSchema } from "@/lib/validation";

/** Data de hoje em São Paulo — o cron e a UI têm de concordar sobre "hoje". */
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const GET = withTenant(async (_req, { tenantId }) => {
  return NextResponse.json(await listBills(tenantId, todayISO()));
});

export const POST = withTenant(async (req, { tenantId }) => {
  const input = await parseBody(req, payableInputSchema);
  const row = await createPayable(tenantId, {
    type: input.type,
    category: input.category ?? null,
    description: input.description ?? null,
    supplier: input.supplier ?? null,
    amount_cents: input.amount_cents ?? null,
    frequency: input.frequency,
    first_due_date: input.first_due_date,
    installments: input.installments ?? null,
    payment_method: input.payment_method ?? null,
    notes: input.notes ?? null,
  });
  return NextResponse.json(row, { status: 201 });
});
