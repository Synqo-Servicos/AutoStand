import { Clock } from "lucide-react";
import type { TenantRow } from "@/lib/schema";

/**
 * Página exibida no lugar da vitrine quando a loja não está `active`
 * (cadastro sem pagamento, ou suspensão). Estilo neutro — não depende do
 * branding do tenant, que pode estar incompleto.
 */
export function LojaIndisponivel({ tenant }: { tenant: TenantRow }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-n50 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-n200 text-n500">
        <Clock className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-n900">{tenant.name}</h1>
      <p className="mt-2 max-w-sm text-n500">
        Esta loja está sendo preparada e estará disponível em breve.
      </p>
      <p className="mt-10 text-xs text-n400">Tecnologia AutoStand</p>
    </main>
  );
}
