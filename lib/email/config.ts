/**
 * Configuração do e-mail transacional. Lê o ambiente em tempo de chamada
 * (não em module-scope) pra facilitar teste e trocar de provider por env.
 *
 * v1: Gmail SMTP (App Password). Trocar pra SES = novo transporte + este
 * `emailProvider()` retornando "ses". Nada nos gatilhos muda.
 */

export function emailProvider(): string {
  return (process.env.EMAIL_PROVIDER ?? "gmail").trim();
}

export function gmailUser(): string {
  return (process.env.GMAIL_USER ?? "contato.synqo@gmail.com").trim();
}

export function gmailAppPassword(): string {
  return (process.env.GMAIL_APP_PASSWORD ?? "").trim();
}

/** Remetente: nome de exibição "AutoStand" + endereço verificado. */
export function emailFrom(): string {
  const name = (process.env.EMAIL_FROM_NAME ?? "AutoStand").trim();
  return `${name} <${gmailUser()}>`;
}

/**
 * E-mail só está habilitado quando há credencial. Sem isso, `sendEmail` vira
 * no-op (loga e segue) — assim homolog sem secret não quebra signup/lead/webhook.
 */
export function isEmailEnabled(): boolean {
  return emailProvider() === "gmail" && gmailAppPassword().length > 0;
}
