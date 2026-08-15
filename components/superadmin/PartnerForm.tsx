"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Copy, Check } from "lucide-react";
import { normalizeSlug } from "@/lib/slug";
import type { PartnerRow } from "@/lib/schema";
import { Button, Field, Input, Select, useConfirm } from "@/components/ui";

const cardClass = "bg-white rounded-xl border border-n200 shadow-xs p-6 space-y-4";

/**
 * CAMPO INATIVO — "Desconto" do parceiro (`discount_type` / `discount_value`).
 *
 * Desativado por decisão de produto em 2026-08-15: o desconto de parceiro não
 * existe como mecanismo próprio. O modelo é "parceiro dá CUPOM", e
 * `coupons.partner_id` já amarra os dois. Estes campos nunca entraram em
 * nenhum cálculo de preço (ver lib/db/partners.ts e lib/coupon-pricing.ts), e
 * 4c0b5b3 já tirou a promessa da página pública de /assinar.
 *
 * Coletá-los aqui era o pior pedaço do problema: o super-admin cadastrava um
 * "15%" na frente do parceiro, e o parceiro saía convencido de que o desconto
 * era real — a tela dava lastro a uma promessa que a cobrança não cumpre.
 *
 * A desativação é só de UI, de propósito: as colunas continuam no banco com o
 * dado histórico intacto (sem migration, sem DELETE), porque a decisão pode ser
 * revista. Se for revista, reativar é restaurar o estado + os dois `Field` —
 * as rotas de /api/superadmin/parceiros ainda aceitam os campos.
 */

export function PartnerForm({ partner }: { partner?: PartnerRow }) {
  const router = useRouter();
  const isEdit = !!partner;

  const [name, setName] = useState(partner?.name ?? "");
  const [code, setCode] = useState(partner?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(isEdit);
  const [maxUses, setMaxUses] = useState(partner?.max_uses != null ? String(partner.max_uses) : "");
  const [expiresAt, setExpiresAt] = useState(partner?.expires_at ?? "");
  const [status, setStatus] = useState(partner?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { confirm, dialog } = useConfirm();

  const partnerLink = code.length >= 3 ? `autostand.com.br/assinar?parceiro=${code}` : "";

  function onNameChange(value: string) {
    setName(value);
    if (!codeTouched) setCode(normalizeSlug(value));
  }

  function copyLink() {
    navigator.clipboard.writeText(`https://${partnerLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(
      isEdit ? `/api/superadmin/parceiros/${partner!.id}` : "/api/superadmin/parceiros",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // `discount_type`/`discount_value` ficam FORA do payload — campo
        // inativo (ver nota no topo do arquivo). No PATCH, a ausência das
        // chaves preserva o que já está gravado; no POST, o banco aplica o
        // default da coluna. Nada é apagado.
        body: JSON.stringify({
          name,
          code,
          max_uses: maxUses || null,
          expires_at: expiresAt || null,
          status,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Não foi possível salvar.");
      setLoading(false);
      return;
    }
    router.push("/superadmin/parceiros");
    router.refresh();
  }

  async function remove() {
    if (!partner) return;
    if (!(await confirm({ title: `Excluir o parceiro "${partner.name}"?`, confirmLabel: "Excluir", danger: true }))) return;
    setLoading(true);
    await fetch(`/api/superadmin/parceiros/${partner.id}`, { method: "DELETE" });
    router.push("/superadmin/parceiros");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {dialog}
      {/* Identificação */}
      <div className={cardClass}>
        <Field label="Nome do parceiro" required>
          {(f) => (
            <Input
              id={f.id}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="João Despachante"
              required
            />
          )}
        </Field>
        <div>
          <Field label="Código do link" required>
            {(f) => (
              <Input
                id={f.id}
                value={code}
                onChange={(e) => {
                  setCode(normalizeSlug(e.target.value));
                  setCodeTouched(true);
                }}
                placeholder="joao-despachante"
                required
              />
            )}
          </Field>
          {partnerLink && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-n50 px-3 py-2">
              <code className="flex-1 truncate text-xs text-n600">{partnerLink}</code>
              <button
                type="button"
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-signal hover:text-signal-dark"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Limites e status */}
      <div className={cardClass}>
        {/*
          No lugar do antigo par "Tipo de desconto" + "Desconto": em vez de um
          campo que não cobra nada, a tela diz onde o desconto realmente mora.
        */}
        <p className="rounded-lg bg-n50 px-3 py-2 text-xs leading-relaxed text-n600">
          <strong className="text-ink">Desconto é por cupom.</strong> O link{" "}
          <code>?parceiro=</code> registra a indicação — ele não abate valor nenhum
          na cobrança. Para o parceiro dar desconto, crie um{" "}
          <Link href="/superadmin/cupons" className="font-medium text-signal hover:text-signal-dark">
            cupom
          </Link>{" "}
          e peça que ele entregue o código ao lojista.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Limite de usos">
            {(f) => (
              <Input
                id={f.id}
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Vazio = ilimitado"
              />
            )}
          </Field>
          <Field label="Validade" helperText="Vazio = sem validade.">
            {(f) => (
              <Input
                id={f.id}
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Status">
          {(f) => (
            <Select
              id={f.id}
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "active", label: "Ativo" },
                { value: "inactive", label: "Inativo" },
              ]}
            />
          )}
        </Field>
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {isEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={remove}
            disabled={loading}
            leadingIcon={<Trash2 className="h-4 w-4" />}
            className="text-danger hover:border-danger/40 hover:bg-danger/10"
          >
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={loading}>
          {isEdit ? "Salvar alterações" : "Cadastrar parceiro"}
        </Button>
      </div>
    </form>
  );
}
