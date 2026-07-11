/**
 * Templates de e-mail (HTML inline). Uma função por tipo → { subject, html }.
 * Layout compartilhado com header/footer AutoStand. Mantido simples de propósito
 * (sem MJML/build) — legível e suficiente pro v1.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function layout(bodyHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f4f5">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1E293B">
    <div style="background:#1E293B;color:#ffffff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:700;font-size:18px">AutoStand</div>
    <div style="background:#ffffff;padding:24px 20px;border-radius:0 0 12px 12px;font-size:15px;line-height:1.55">${bodyHtml}</div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0">AutoStand — sites e gestão para concessionárias</p>
  </div></body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${esc(url)}" style="background:#DC2626;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;
}

// — Lead novo → gestor da concessionária ————————————————————————————

export function leadNotification(p: {
  leadName: string;
  phone: string;
  message?: string | null;
  vehicleTitle?: string | null;
  panelUrl: string;
}): RenderedEmail {
  const veic = p.vehicleTitle ? ` interessado em <strong>${esc(p.vehicleTitle)}</strong>` : "";
  const msg = p.message ? `<p style="background:#f8fafc;border-left:3px solid #DC2626;padding:8px 12px;margin:12px 0">${esc(p.message)}</p>` : "";
  return {
    subject: `Novo lead: ${p.leadName}`,
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Você recebeu um novo lead 🎯</h2>
       <p><strong>${esc(p.leadName)}</strong>${veic}.</p>
       <p>📞 <a href="tel:${esc(p.phone)}" style="color:#DC2626">${esc(p.phone)}</a></p>
       ${msg}
       ${button(p.panelUrl, "Ver no painel")}
       <p style="color:#64748b;font-size:13px">Responda rápido — leads contatados na 1ª hora convertem muito mais.</p>`,
    ),
  };
}

// — Ciclo de pagamento → cliente ————————————————————————————————————

export function paymentActive(p: { siteUrl: string; panelUrl: string }): RenderedEmail {
  return {
    subject: "Seu site está no ar! 🎉",
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Pagamento confirmado — seu site está no ar 🎉</h2>
       <p>Sua loja já está publicada e recebendo visitas.</p>
       ${button(p.siteUrl, "Ver meu site")}
       <p style="font-size:14px">Gerencie estoque, leads e o visual pelo painel:<br>
       <a href="${esc(p.panelUrl)}" style="color:#DC2626">${esc(p.panelUrl)}</a></p>`,
    ),
  };
}

export function paymentPastDue(p: { panelUrl: string }): RenderedEmail {
  return {
    subject: "Ação necessária: atualize seu pagamento",
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Não conseguimos processar seu pagamento</h2>
       <p>Para manter seu site no ar, atualize os dados do cartão. Sem isso, a loja pode ser suspensa.</p>
       ${button(p.panelUrl + "/assinatura", "Atualizar pagamento")}`,
    ),
  };
}

export function paymentCancelled(): RenderedEmail {
  return {
    subject: "Sua assinatura foi cancelada",
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Assinatura cancelada</h2>
       <p>Sua assinatura do AutoStand foi cancelada e o site saiu do ar. Quer voltar? É só assinar de novo — seus dados ficam guardados.</p>
       <p>Qualquer dúvida, é só responder este e-mail.</p>`,
    ),
  };
}

// — Reset de senha ——————————————————————————————————————————————————

export function passwordReset(p: { resetUrl: string }): RenderedEmail {
  return {
    subject: "Redefinição de senha — AutoStand",
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Redefinir sua senha</h2>
       <p>Recebemos um pedido para redefinir sua senha. O link expira em 1 hora.</p>
       ${button(p.resetUrl, "Redefinir senha")}
       <p style="color:#64748b;font-size:13px">Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>`,
    ),
  };
}

// — Alertas internos → super-admins ————————————————————————————————

export function superadminNewSubscription(p: { dealershipName: string; plan: string }): RenderedEmail {
  return {
    subject: `💰 Nova assinatura: ${p.dealershipName}`,
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Nova assinatura ativa 💰</h2>
       <p><strong>${esc(p.dealershipName)}</strong> assinou o plano <strong>${esc(p.plan)}</strong> e está no ar.</p>`,
    ),
  };
}

export function superadminPaymentFailure(p: { dealershipName: string; status: string }): RenderedEmail {
  return {
    subject: `⚠️ Falha de pagamento: ${p.dealershipName}`,
    html: layout(
      `<h2 style="margin:0 0 8px;font-size:18px">Falha de pagamento ⚠️</h2>
       <p><strong>${esc(p.dealershipName)}</strong> — status <strong>${esc(p.status)}</strong>. Possível churn; vale acompanhar.</p>`,
    ),
  };
}
