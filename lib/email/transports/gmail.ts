import nodemailer, { type Transporter } from "nodemailer";
import { gmailAppPassword, gmailUser } from "@/lib/email/config";

/**
 * Transporte SMTP do Gmail (porta 587 STARTTLS, autenticação por App Password).
 * O próprio Google assina o e-mail (DKIM/SPF dele) → boa entrega mesmo sem
 * domínio verificado. Cacheia o transporter pra reusar a conexão.
 */
let cached: Transporter | null = null;

export function gmailTransport(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: gmailUser(), pass: gmailAppPassword() },
  });
  return cached;
}
