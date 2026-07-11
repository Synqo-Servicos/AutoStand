"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Copy, Check } from "lucide-react";
import { normalizeSlug } from "@/lib/slug";
import type { PartnerRow } from "@/lib/schema";
import { useConfirm } from "@/components/ui";

const inputClass =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent";
const labelClass = "block text-xs font-medium text-n600 mb-1";
const cardClass = "bg-white rounded-xl border border-n200/70 p-6 space-y-4";

export function PartnerForm({ partner }: { partner?: PartnerRow }) {
  const router = useRouter();
  const isEdit = !!partner;

  const [name, setName] = useState(partner?.name ?? "");
  const [code, setCode] = useState(partner?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(isEdit);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    partner?.discount_type === "amount" ? "amount" : "percent",
  );
  const [discountValue, setDiscountValue] = useState(
    partner
      ? partner.discount_type === "amount"
        ? String(partner.discount_value / 100)
        : String(partner.discount_value)
      : "",
  );
  const [maxUses, setMaxUses] = useState(partner?.max_uses != null ? String(partner.max_uses) : "");
  const [expiresAt, setExpiresAt] = useState(partner?.expires_at ?? "");
  const [status, setStatus] = useState(partner?.status ?? "active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

    const discount_value =
      discountType === "amount"
        ? Math.round((Number(discountValue) || 0) * 100)
        : Math.round(Number(discountValue) || 0);

    const res = await fetch(
      isEdit ? `/api/superadmin/parceiros/${partner!.id}` : "/api/superadmin/parceiros",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          discount_type: discountType,
          discount_value,
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

  const { confirm, dialog } = useConfirm();

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
        <div>
          <label className={labelClass}>
            Nome do parceiro <span className="text-danger">*</span>
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="João Despachante"
            required
          />
        </div>
        <div>
          <label className={labelClass}>
            Código do link <span className="text-danger">*</span>
          </label>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => {
              setCode(normalizeSlug(e.target.value));
              setCodeTouched(true);
            }}
            placeholder="joao-despachante"
            required
          />
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

      {/* Desconto e limites */}
      <div className={cardClass}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de desconto</label>
            <select
              className={inputClass}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
            >
              <option value="percent">Percentual (%)</option>
              <option value="amount">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              {discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}
            </label>
            <input
              className={inputClass}
              type="number"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percent" ? "15" : "50"}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Limite de usos</label>
            <input
              className={inputClass}
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Vazio = ilimitado"
            />
          </div>
          <div>
            <label className={labelClass}>Validade</label>
            <input
              className={inputClass}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-n400">Vazio = sem validade.</p>
          </div>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {isEdit ? (
          <button
            type="button"
            onClick={remove}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-n200 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-dark disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Cadastrar parceiro"}
        </button>
      </div>
    </form>
  );
}
