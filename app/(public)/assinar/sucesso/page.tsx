import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestHost, isPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastro recebido — AutoStand",
};

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isPlatformHost(await getRequestHost())) notFound();

  const sp = await searchParams;
  const loja = typeof sp.loja === "string" ? sp.loja : "";

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-ink"
        aria-hidden="true"
      >
        ✓
      </div>
      <h1 className="mt-6 font-display text-h2 font-semibold text-ink">Cadastro recebido!</h1>
      <p className="mt-3 text-body text-n600">
        A conta da sua loja foi criada
        {loja && (
          <>
            {" "}
            em <strong className="text-ink">{loja}.autostand.com.br</strong>
          </>
        )}
        . Para colocar o site no ar, falta a confirmação do primeiro pagamento — em
        breve você recebe as instruções por e-mail.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-ink px-6 py-3 font-semibold text-white transition-colors hover:bg-ink-800"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
