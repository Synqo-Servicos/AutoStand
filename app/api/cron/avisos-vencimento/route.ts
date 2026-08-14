import { NextRequest, NextResponse } from "next/server";
import {
  claimNotifications, listBills, listTenantsForBillDigest, releaseNotifications,
} from "@/lib/db";
import { notifyUpcomingBills } from "@/lib/email/notify";
import { stageForToday } from "@/lib/recurring";
import type { BillLine } from "@/lib/email/templates";

const KIND = "vencimento";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Digest diário de contas a vencer. Agendado em vercel.json para 11:00
 * UTC = 08:00 BRT — cron da Vercel roda em UTC, e `0 8 * * *` entregaria
 * às 5 da manhã.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const tenants = await listTenantsForBillDigest();
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const bills = await listBills(tenant.id, today);

      const due = bills
        .filter((b) => b.status !== "pago")
        .map((b) => ({ bill: b, stage: stageForToday(b.due_date, b.payment_method, today) }))
        .filter((x): x is { bill: (typeof bills)[number]; stage: string } => x.stage !== null);

      if (due.length === 0) continue;

      const keys = due.map((d) => `${d.bill.payable_id}:${d.bill.due_date}:${d.stage}`);
      const claimed = await claimNotifications(tenant.id, KIND, keys);
      if (claimed.length === 0) continue;

      const claimedSet = new Set(claimed);
      const lines: BillLine[] = due
        .filter((d) => claimedSet.has(`${d.bill.payable_id}:${d.bill.due_date}:${d.stage}`))
        .map((d) => ({
          label: [d.bill.category ?? d.bill.description ?? "Conta", d.bill.supplier]
            .filter(Boolean).join(" — "),
          dueDate: d.bill.due_date,
          amountCents: d.bill.amount_cents,
          status: d.bill.status === "atrasado" ? "atrasado"
                : d.bill.status === "vence_hoje" ? "vence_hoje"
                : "a_vencer",
        }));

      try {
        await notifyUpcomingBills(tenant, lines);
        sent++;
      } catch (err) {
        // Devolve o claim: sem isso, a falha de hoje viraria silêncio permanente.
        await releaseNotifications(tenant.id, KIND, claimed);
        console.error(`[cron] digest falhou para tenant ${tenant.id}:`, err);
      }
    } catch (err) {
      // Um tenant quebrado não pode impedir o aviso dos demais.
      console.error(`[cron] tenant ${tenant.id} falhou:`, err);
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants.length, sent });
}
