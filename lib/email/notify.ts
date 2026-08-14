import { getSuperAdminEmails, getTenantAdminEmail } from "@/lib/db";
import { tenantSiteUrl } from "@/lib/marketplace";
import type { TenantRow } from "@/lib/schema";
import { isEmailEnabled } from "./config";
import { sendEmail } from "./send";
import * as tpl from "./templates";

/**
 * Camada de notificação: resolve destinatário + monta template + envia.
 * Cada função é BEST-EFFORT e NUNCA lança (envolve tudo em try/catch) — pode ser
 * chamada com `void notifyX(...)` (fire-and-forget) sem risco de derrubar o fluxo.
 */

async function tenantRecipient(tenant: TenantRow): Promise<string | null> {
  return tenant.contact_email?.trim() || (await getTenantAdminEmail(tenant.id));
}

/** Lead novo → gestor da concessionária. */
export async function notifyNewLead(
  tenant: TenantRow,
  lead: { name: string; phone: string; message?: string | null },
  vehicleTitle?: string | null,
): Promise<void> {
  try {
    const to = await tenantRecipient(tenant);
    if (!to) return;
    const panelUrl = `${tenantSiteUrl(tenant)}/admin/leads`;
    const r = tpl.leadNotification({
      leadName: lead.name,
      phone: lead.phone,
      message: lead.message ?? null,
      vehicleTitle: vehicleTitle ?? null,
      panelUrl,
    });
    await sendEmail({ to, subject: r.subject, html: r.html });
  } catch (err) {
    console.error("[email] notifyNewLead falhou:", err);
  }
}

/**
 * Ciclo de pagamento (status interno já resolvido pelo webhook):
 * avisa o cliente E dispara o alerta interno pros super-admins.
 */
export async function notifyPaymentStatus(tenant: TenantRow, status: string): Promise<void> {
  try {
    // Tenants de diagnóstico (diag-) nunca notificam cliente nem super-admin.
    if (tenant.slug.startsWith("diag-")) return;
    const site = tenantSiteUrl(tenant);
    const panelUrl = `${site}/admin`;

    let clientEmail: tpl.RenderedEmail | null = null;
    if (status === "active") clientEmail = tpl.paymentActive({ siteUrl: site, panelUrl });
    else if (status === "past_due") clientEmail = tpl.paymentPastDue({ panelUrl });
    else if (status === "cancelled") clientEmail = tpl.paymentCancelled();
    else return; // status sem notificação

    const to = await tenantRecipient(tenant);
    if (to && clientEmail) await sendEmail({ to, subject: clientEmail.subject, html: clientEmail.html });

    const admins = await getSuperAdminEmails();
    if (admins.length) {
      const alert =
        status === "active"
          ? tpl.superadminNewSubscription({ dealershipName: tenant.name, plan: tenant.plan ?? "—" })
          : tpl.superadminPaymentFailure({ dealershipName: tenant.name, status });
      await sendEmail({ to: admins, subject: alert.subject, html: alert.html });
    }
  } catch (err) {
    console.error("[email] notifyPaymentStatus falhou:", err);
  }
}

/**
 * Contas a vencer / atrasadas → gestor da concessionária.
 *
 * DIFERENTE das demais funções deste arquivo: esta NÃO é best-effort e
 * PROPOSITALMENTE não tem try/catch. Quem chama é o cron (Task 8), que precisa
 * saber da falha de envio para devolver o claim de idempotência e retentar
 * amanhã — se engolíssemos o erro aqui, o cron marcaria como enviado algo que
 * nunca saiu, e o lojista ficaria em silêncio permanente sobre a conta a vencer.
 *
 * Nota: `sendEmail` em si é best-effort (nunca lança, devolve `false` em falha),
 * então convertemos esse `false` em exceção para que a falha realmente propague
 * até o chamador — MAS só quando o provider está habilitado. `isEmailEnabled()`
 * falso (sem GMAIL_APP_PASSWORD, ex.: homolog) é um estado intencional e
 * permanente (ver `lib/email/config.ts`), não uma falha transitória: se
 * tratássemos os dois casos como a mesma exceção, o cron reteria o claim e
 * retentaria todo dia, para sempre, sem que retry nenhum resolvesse — ruído
 * indefinido que ainda esconderia um alerta real de falha de infra por baixo
 * de um alerta permanente de "sem credencial". Por isso "desligado" segue o
 * mesmo caminho de no-op gracioso dos outros early-returns (bills vazio,
 * sem destinatário) e só falha REAL de envio, com o provider ligado, lança.
 */
export async function notifyUpcomingBills(
  tenant: TenantRow,
  bills: tpl.BillLine[],
): Promise<void> {
  if (bills.length === 0) return;
  const to = await tenantRecipient(tenant);
  if (!to) return;
  if (!isEmailEnabled()) return;

  const r = tpl.upcomingBills({
    dealershipName: tenant.name,
    panelUrl: `${tenantSiteUrl(tenant)}/admin/financeiro?tab=contas`,
    bills,
  });
  const sent = await sendEmail({ to, subject: r.subject, html: r.html });
  if (!sent) {
    throw new Error(`[email] notifyUpcomingBills: falha ao enviar para tenant ${tenant.id}`);
  }
}
