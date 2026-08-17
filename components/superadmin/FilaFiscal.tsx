"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import type { PaymentRow } from "@/lib/schema";
import { competenciaDeInstante } from "@/lib/competencia";
import { formatBRLFull } from "@/lib/money";
import {
  Button, Card, CardBody, CardDescription, CardHeader, CardTitle,
  EmptyState, Input, toast,
} from "@/components/ui";

/**
 * Competência do pagamento como `MM/AAAA`.
 *
 * O mês vem de `competenciaDeInstante` (lib/competencia.ts) — o MESMO
 * classificador que `sumCaixa` e a base do DAS usam. Antes esta função tinha
 * opinião própria e empilhava dois fusos: `new Date(paidAt)` interpretava a
 * string ingênua do Postgres como hora LOCAL do navegador, e o `getUTCMonth()`
 * seguinte relia aquilo em UTC. Num navegador em São Paulo, um pagamento das
 * 22h de 31/08 aparecia aqui como "Competência 09/2026" enquanto o Caixa da
 * mesma tela contava ele em agosto — e é esta linha que o contador lê para
 * decidir em que mês emitir a NFS-e.
 *
 * `YYYY-MM` → `MM/AAAA` é só recorte de string, sem `Date` no meio — mesmo
 * estilo de `mesBR` em ImpostoCard.
 */
function competenciaDe(paidAt: string): string | null {
  const competencia = competenciaDeInstante(paidAt);
  if (!competencia) return null;
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

interface Props {
  payments: PaymentRow[];
}

/**
 * Fila de trabalho do contador: pagamentos aprovados que ainda não viraram
 * NFS-e. A emissão em si continua manual no portal — aqui só se cola o
 * número depois. Traz pagador, documento, valor e competência lado a lado
 * com o campo do número: nada disso obriga abrir outra tela pra emitir.
 */
export function FilaFiscal({ payments }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-signal" />
          <CardTitle>Fila fiscal</CardTitle>
        </div>
        <CardDescription>
          {payments.length === 0
            ? "Nenhum pagamento pendente de nota."
            : `${payments.length} pagamento${payments.length === 1 ? "" : "s"} aguardando NFS-e`}
        </CardDescription>
      </CardHeader>
      <CardBody>
        {payments.length === 0 ? (
          <EmptyState
            className="-mx-6"
            icon={Receipt}
            title="Nenhuma nota pendente"
            description="Todo pagamento aprovado já tem NFS-e registrada."
            compact
          />
        ) : (
          <ul className="-mx-6 divide-y divide-n100">
            {payments.map((p) => (
              <FilaFiscalRow key={p.id} payment={p} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function FilaFiscalRow({ payment }: { payment: PaymentRow }) {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = numero.trim();
    if (!trimmed) {
      setError("Informe o número da nota.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/payments/${payment.id}/nfse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar a nota.");
      toast.success("NFS-e registrada.");
      // A linha some porque o pai (página server) refaz listPendingNfse()
      // ao receber o refresh — não removemos localmente pra não divergir
      // do que o banco realmente tem.
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="px-6 py-3">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink truncate">{payment.tenant_name}</p>
          <p className="text-body-s text-n600 mt-0.5">
            {payment.tenant_document ?? "Documento não informado"} ·{" "}
            {/* Carimbo ilegível vira ausência declarada, nunca um mês chutado:
                esta linha decide em que competência a nota é emitida. */}
            {competenciaDe(payment.paid_at)
              ? `Competência ${competenciaDe(payment.paid_at)}`
              : "Competência indisponível"}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="w-28 shrink-0 text-right font-medium text-ink tabular-nums">
            {formatBRLFull(payment.gross_cents)}
          </span>
          <Input
            size="sm"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número da NFS-e"
            aria-label={`Número da NFS-e para ${payment.tenant_name}`}
            className="w-40"
          />
          <Button type="submit" size="sm" loading={saving}>
            Registrar
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-body-s text-danger">{error}</p>}
    </li>
  );
}
