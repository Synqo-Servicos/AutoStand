import { Store, TrendingUp, Users, ExternalLink } from "lucide-react";
import { getAdminTenant } from "@/lib/tenant";
import { MarketplaceToggle } from "@/components/admin/MarketplaceToggle";
import { PLATFORM_DOMAIN } from "@/lib/platform";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: TrendingUp, title: "Mais alcance", text: "Seu estoque aparece para quem busca carro no portal AutoStand, não só no seu site." },
  { icon: Users, title: "Leads para a sua loja", text: "Quem se interessa por um veículo seu vira lead na sua conta — direto no /admin/leads." },
  { icon: Store, title: "Seu site continua o seu", text: "O marketplace é uma vitrine extra. As páginas levam o cliente para o site e o WhatsApp da sua loja." },
];

export default async function MarketplacePage() {
  const tenant = await getAdminTenant();

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-h2 font-semibold text-ink">Marketplace AutoStand</h1>
        <p className="text-sm text-n600 mt-1">
          Apareça no portal de busca da AutoStand e receba leads de novos compradores.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-n100 p-6 mb-6">
        <h2 className="font-display text-h3 font-semibold text-ink mb-1">Participar do marketplace</h2>
        <p className="text-xs text-n500 mb-5">
          A adesão é opcional e você pode sair quando quiser. Disponível em todos os planos.
        </p>
        <MarketplaceToggle initial={tenant.marketplace_opt_in} />
        {tenant.marketplace_opt_in && (
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-ink">
            <ExternalLink className="w-4 h-4 shrink-0 text-success" />
            <span className="min-w-0">
              Seu perfil:{" "}
              <span className="font-medium min-w-0 break-all">{PLATFORM_DOMAIN}/loja/{tenant.slug}</span>
            </span>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-white rounded-xl border border-n100 p-5">
            <Icon className="w-5 h-5 text-signal" />
            <h3 className="font-display text-body-s font-semibold text-ink mt-3">{title}</h3>
            <p className="text-xs text-n600 mt-1 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
