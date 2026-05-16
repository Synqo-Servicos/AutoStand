import { PartnerForm } from "@/components/superadmin/PartnerForm";

export default function NovoParceiroPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Novo parceiro</h1>
        <p className="text-sm text-n600 mt-1">
          Crie um link de indicação com desconto e atribuição de cadastros.
        </p>
      </div>
      <PartnerForm />
    </div>
  );
}
