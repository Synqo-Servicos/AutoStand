import { TenantForm } from "@/components/superadmin/TenantForm";

export default function NovoTenantPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-h1 font-semibold text-ink">Nova concessionária</h1>
        <p className="text-sm text-n600 mt-1">
          Cadastre um novo cliente whitelabel e, opcionalmente, o administrador dele.
        </p>
      </div>
      <TenantForm />
    </div>
  );
}
