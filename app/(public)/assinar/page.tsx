import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestHost, isPlatformHost } from "@/lib/tenant";
import { getPartnerByCode } from "@/lib/db";
import { isPlanSlug, type PlanSlug } from "@/lib/plans";
import { SignupForm } from "@/components/marketing/SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assinar — AutoStand",
  description: "Crie a conta da sua concessionária na AutoStand.",
};

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Cadastro pertence ao site da plataforma, não às lojas dos tenants.
  if (!isPlatformHost(await getRequestHost())) notFound();

  const sp = await searchParams;
  const planParam = typeof sp.plano === "string" ? sp.plano : "";
  const defaultPlan: PlanSlug = isPlanSlug(planParam) ? planParam : "pro";
  const partnerCode = typeof sp.parceiro === "string" ? sp.parceiro.trim() : "";
  const partner = partnerCode ? await getPartnerByCode(partnerCode) : null;

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="text-eyebrow font-semibold uppercase text-signal">Cadastro</p>
      <h1 className="mt-3 font-display text-h2 font-semibold text-ink">
        Crie a conta da sua loja.
      </h1>
      <p className="mt-2 text-body text-n600">
        Poucos minutos para ter site e painel de gestão próprios.
      </p>

      {/*
        A indicação é registrada (tenants.referred_by) — mas o link, sozinho,
        NÃO dá desconto: desconto de indicação vem por cupom. Não prometa
        abatimento automático aqui; até ago/2026 esta faixa dizia "o desconto é
        aplicado no pagamento" e o cliente pagava o preço cheio.
      */}
      {partner && (
        <p className="mt-5 rounded-lg bg-signal/10 px-3 py-2 text-body-s text-ink">
          Indicação de <strong>{partner.name}</strong> — vamos registrar que você veio por
          este link. Se você recebeu um <strong>código de cupom</strong>, informe-o no campo
          &ldquo;Código de cupom&rdquo; abaixo para que o desconto entre no pagamento.
        </p>
      )}

      <div className="mt-8">
        <SignupForm defaultPlan={defaultPlan} partnerCode={partner ? partnerCode : undefined} />
      </div>
    </div>
  );
}
