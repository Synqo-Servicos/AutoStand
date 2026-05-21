import Image from "next/image";
import { resolveBanks } from "@/lib/banks";

interface Props {
  slugs: string[] | null | undefined;
  variant?: "footer" | "compact";
  className?: string;
}

/**
 * Mostra os bancos parceiros da concessionária.
 *
 *  - `footer`  : grid de logos, p/ rodapé do site público.
 *  - `compact` : linha textual ("Trabalhamos com … "), p/ usar perto do CTA.
 *
 * Quando o tenant não tem nenhum banco selecionado, o componente não
 * renderiza nada — então pode ser plugado sem proteção condicional.
 */
export function PartnerBanks({ slugs, variant = "footer", className = "" }: Props) {
  const banks = resolveBanks(slugs);
  if (banks.length === 0) return null;

  if (variant === "compact") {
    const names = banks.slice(0, 5).map((b) => b.name);
    const tail = banks.length > 5 ? ` e mais ${banks.length - 5}` : "";
    return (
      <p className={`text-sm text-n600 ${className}`}>
        Trabalhamos com financiamento via{" "}
        <span className="font-medium text-ink">
          {names.join(", ")}
          {tail}
        </span>
        .
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-widest text-n500 mb-3">
        Financiamento parceiro
      </p>
      <ul className="flex flex-wrap items-center gap-3" aria-label="Bancos parceiros">
        {banks.map((bank) => (
          <li
            key={bank.slug}
            className="relative h-10 w-24 overflow-hidden rounded-md ring-1 ring-black/5 bg-white"
            title={bank.name}
          >
            <Image
              src={bank.logo}
              alt={bank.name}
              fill
              sizes="96px"
              className="object-contain"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
