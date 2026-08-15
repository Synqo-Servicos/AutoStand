import { PartnerForm } from "@/components/superadmin/PartnerForm";

export default function NovoParceiroPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-h1 font-semibold text-ink">Novo parceiro</h1>
        {/*
          Não dizer "com desconto": o link de parceiro faz atribuição, não
          abatimento (campo de desconto inativo desde 2026-08-15 — desconto de
          parceiro é por cupom vinculado). Ver components/superadmin/PartnerForm.tsx.
        */}
        <p className="text-sm text-n600 mt-1">
          Crie um link de indicação com atribuição de cadastros.
        </p>
      </div>
      <PartnerForm />
    </div>
  );
}
