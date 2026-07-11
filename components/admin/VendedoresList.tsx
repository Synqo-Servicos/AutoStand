"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { centsToDisplay, displayToCents, formatBRL } from "@/lib/money";
import { Button, Field, Input, Modal, Select, useConfirm, toast } from "@/components/ui";
import type { Seller } from "@/types/seller";

interface Props {
  initialSellers: Seller[];
}

export function VendedoresList({ initialSellers }: Props) {
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [editing, setEditing] = useState<Seller | "new" | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDelete(s: Seller) {
    const ok = await confirm({
      title: `Excluir o vendedor "${s.name}"?`,
      description: "O histórico de comissões já registrado não será apagado.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/sellers/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir. Tente novamente.");
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
      {dialog}
      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Equipe ({sellers.length})</h2>
          <Button
            type="button"
            size="sm"
            onClick={() => setEditing("new")}
            leadingIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Adicionar vendedor
          </Button>
        </header>

        {sellers.length === 0 ? (
          <div className="py-16 text-center text-sm text-n400">
            Nenhum vendedor cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(s)}
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s)}
                      aria-label="Excluir"
                      className="text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

  async function handleSubmit() {
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
    <Modal
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="lg"
      title={isEdit ? "Editar vendedor" : "Novo vendedor"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome" required>
          {(f) => (
            <Input
              id={f.id}
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone">
            {(f) => (
              <Input
                id={f.id}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11999990000"
              />
            )}
          </Field>
          <Field label="Email">
            {(f) => (
              <Input
                id={f.id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendedor@loja.com"
              />
            )}
          </Field>
        </div>

        <Field label="CPF">
          {(f) => (
            <Input
              id={f.id}
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="000.000.000-00"
            />
          )}
        </Field>

        <Field label="Foto (URL pública)">
          {(f) => (
            <Input
              id={f.id}
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          )}
        </Field>

        <div className="border-t border-n100 pt-4">
          <p className="text-xs font-semibold text-ink mb-2">Comissão por venda</p>
          <p className="text-[11px] text-n400 mb-3">
            Aplicada automaticamente quando uma venda é registrada com este vendedor.
            Pode usar só % ou só fixo, ou os dois somados.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Comissão (%)">
              {(f) => (
                <Input
                  id={f.id}
                  type="text"
                  value={pctStr}
                  onChange={(e) => setPctStr(e.target.value)}
                  placeholder="Ex: 3.5"
                />
              )}
            </Field>
            <Field label="Comissão fixa (R$)">
              {(f) => (
                <Input
                  id={f.id}
                  type="text"
                  value={fixedStr}
                  onChange={(e) => setFixedStr(e.target.value)}
                  onBlur={() => setFixedStr(fixedStr.trim() ? centsToDisplay(displayToCents(fixedStr)) : "")}
                  placeholder="Ex: 500"
                />
              )}
            </Field>
          </div>
        </div>

        <Field label="Status">
          {(f) => (
            <Select
              id={f.id}
              value={status}
              onValueChange={(v) => setStatus(v as Seller["status"])}
              options={[
                { value: "ativo", label: "Ativo" },
                { value: "desligado", label: "Desligado" },
              ]}
            />
          )}
        </Field>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
