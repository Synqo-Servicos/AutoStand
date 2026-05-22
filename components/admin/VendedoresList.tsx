"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { centsToDisplay, displayToCents, formatBRL } from "@/lib/money";
import type { Seller } from "@/types/seller";

interface Props {
  initialSellers: Seller[];
}

const inp =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";
const lbl = "block text-xs font-medium text-n600 mb-1";

export function VendedoresList({ initialSellers }: Props) {
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [editing, setEditing] = useState<Seller | "new" | null>(null);

  async function handleDelete(s: Seller) {
    if (!confirm(`Excluir o vendedor "${s.name}"?\n\nO histórico de comissões já registrado não será apagado.`)) return;
    const res = await fetch(`/api/sellers/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Erro ao excluir");
      return;
    }
    setSellers((prev) => prev.filter((x) => x.id !== s.id));
  }

  function handleSaved(saved: Seller) {
    setSellers((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      const next = exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      return [...next].sort((a, b) =>
        a.status === b.status ? a.name.localeCompare(b.name) : a.status.localeCompare(b.status),
      );
    });
    setEditing(null);
  }

  return (
    <>
      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Equipe ({sellers.length})</h2>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 bg-signal text-ink text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-signal-dark transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar vendedor
          </button>
        </header>

        {sellers.length === 0 ? (
          <div className="py-16 text-center text-sm text-n400">
            Nenhum vendedor cadastrado.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-n50">
              <tr>
                <Th>Nome</Th>
                <Th>Contato</Th>
                <Th align="right">Comissão</Th>
                <Th>Status</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-n100">
              {sellers.map((s) => (
                <tr key={s.id} className={`hover:bg-n50/60 ${s.status === "desligado" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{s.name}</td>
                  <td className="px-4 py-3 text-n600 whitespace-nowrap">
                    {s.phone ?? s.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {formatCommission(s)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      s.status === "ativo"
                        ? "bg-success/12 text-ink ring-1 ring-success/30"
                        : "bg-n100 text-n600 ring-1 ring-n200"
                    }`}>
                      {s.status === "ativo" ? "Ativo" : "Desligado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-n400 hover:text-ink hover:bg-n100 transition-colors cursor-pointer"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-n400 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <SellerEditor
          seller={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function formatCommission(s: Seller): string {
  const pctPart = s.commission_pct ? `${(s.commission_pct / 100).toFixed(s.commission_pct % 100 === 0 ? 0 : 2)}%` : null;
  const fixedPart = s.commission_fixed_cents ? formatBRL(s.commission_fixed_cents) : null;
  if (pctPart && fixedPart) return `${pctPart} + ${fixedPart}`;
  return pctPart ?? fixedPart ?? "—";
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold text-n600 uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

interface EditorProps {
  seller: Seller | null;
  onClose: () => void;
  onSaved: (s: Seller) => void;
}

function SellerEditor({ seller, onClose, onSaved }: EditorProps) {
  const isEdit = !!seller;
  const [name, setName] = useState(seller?.name ?? "");
  const [phone, setPhone] = useState(seller?.phone ?? "");
  const [email, setEmail] = useState(seller?.email ?? "");
  const [document, setDocument] = useState(seller?.document ?? "");
  const [photoUrl, setPhotoUrl] = useState(seller?.photo_url ?? "");
  const [pctStr, setPctStr] = useState(seller?.commission_pct ? (seller.commission_pct / 100).toString() : "");
  const [fixedStr, setFixedStr] = useState(seller?.commission_fixed_cents ? centsToDisplay(seller.commission_fixed_cents) : "");
  const [status, setStatus] = useState<Seller["status"]>(seller?.status ?? "ativo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const pctValue = pctStr.trim() ? Math.round(parseFloat(pctStr.replace(",", ".")) * 100) : null;
      const fixedValue = fixedStr.trim() ? displayToCents(fixedStr) : null;
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        document: document.trim() || null,
        photo_url: photoUrl.trim() || null,
        commission_pct: Number.isFinite(pctValue) ? pctValue : null,
        commission_fixed_cents: fixedValue,
        status,
      };
      const res = await fetch(isEdit ? `/api/sellers/${seller!.id}` : "/api/sellers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSaved(data as Seller);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <h3 className="text-base font-semibold text-ink">
            {isEdit ? "Editar vendedor" : "Novo vendedor"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-n400 hover:bg-n100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={lbl}>Nome *</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Ex: João Silva" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Telefone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="11999990000" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} placeholder="vendedor@loja.com" />
            </div>
          </div>

          <div>
            <label className={lbl}>CPF</label>
            <input type="text" value={document} onChange={(e) => setDocument(e.target.value)} className={inp} placeholder="000.000.000-00" />
          </div>

          <div>
            <label className={lbl}>Foto (URL pública)</label>
            <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className={inp} placeholder="https://..." />
          </div>

          <div className="border-t border-n100 pt-4">
            <p className="text-xs font-semibold text-ink mb-2">Comissão por venda</p>
            <p className="text-[11px] text-n400 mb-3">
              Aplicada automaticamente quando uma venda é registrada com este vendedor.
              Pode usar só % ou só fixo, ou os dois somados.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Comissão (%)</label>
                <input
                  type="text"
                  value={pctStr}
                  onChange={(e) => setPctStr(e.target.value)}
                  className={inp}
                  placeholder="Ex: 3.5"
                />
              </div>
              <div>
                <label className={lbl}>Comissão fixa (R$)</label>
                <input
                  type="text"
                  value={fixedStr}
                  onChange={(e) => setFixedStr(e.target.value)}
                  onBlur={() => setFixedStr(fixedStr.trim() ? centsToDisplay(displayToCents(fixedStr)) : "")}
                  className={inp}
                  placeholder="Ex: 500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Seller["status"])} className={inp}>
              <option value="ativo">Ativo</option>
              <option value="desligado">Desligado</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="bg-n50 border-t border-n100 px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
