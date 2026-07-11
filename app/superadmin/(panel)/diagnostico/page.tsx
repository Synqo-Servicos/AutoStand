import { PaymentDiagnostics } from "@/components/superadmin/PaymentDiagnostics";

export const metadata = { title: "Diagnóstico — Plataforma" };

export default function DiagnosticoPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 font-semibold text-ink mb-1">Diagnóstico de pagamentos</h1>
      <p className="text-n600 text-sm mb-6">
        Ferramentas para validar o processamento de pagamentos em produção.
      </p>
      <PaymentDiagnostics />
    </div>
  );
}
