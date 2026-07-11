import { emailFrom, emailProvider, isEmailEnabled } from "@/lib/email/config";
import { gmailTransport } from "@/lib/email/transports/gmail";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Envia um e-mail. BEST-EFFORT: NUNCA lança — captura e loga (CloudWatch).
 * Retorna true se enviou, false se desligado/desconhecido/falhou. Os chamadores
 * fazem fire-and-forget: um e-mail que falha jamais derruba o fluxo de negócio.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (!isEmailEnabled()) {
    console.warn("[email] desabilitado (sem credencial) — pulado:", msg.subject);
    return false;
  }
  try {
    if (emailProvider() === "gmail") {
      await gmailTransport().sendMail({
        from: emailFrom(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
      });
      return true;
    }
    console.error("[email] provider desconhecido:", emailProvider());
    return false;
  } catch (err) {
    console.error("[email] falha ao enviar:", msg.subject, err);
    return false;
  }
}
