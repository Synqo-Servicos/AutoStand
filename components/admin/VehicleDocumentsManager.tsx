"use client";

import { useRef, useState, useTransition } from "react";
import {
  Download, FileText, Loader2, Paperclip, Trash2, Upload,
} from "lucide-react";
import type { VehicleDocumentRow } from "@/lib/schema";
import { useConfirm } from "@/components/ui";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "crlv",      label: "CRLV / Licenciamento" },
  { value: "laudo",     label: "Laudo cautelar / Vistoria" },
  { value: "dut",       label: "DUT / ATPV-e" },
  { value: "nf_peca",   label: "NF de peça / serviço" },
  { value: "os",        label: "Ordem de Serviço" },
  { value: "contrato",  label: "Contrato assinado" },
  { value: "historico", label: "Histórico / consulta" },
  { value: "outros",    label: "Outros" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VehicleDocumentsManager({
  vehicleId,
  initialDocuments,
}: {
  vehicleId: number;
  initialDocuments: VehicleDocumentRow[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [category, setCategory] = useState<string>("crlv");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (name.trim()) formData.append("name", name.trim());

      const res = await fetch(`/api/vehicles/${vehicleId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Falha no upload");
      }
      const created = (await res.json()) as VehicleDocumentRow;
      setDocuments((prev) => [created, ...prev]);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const { confirm, dialog } = useConfirm();

  async function handleDelete(doc: VehicleDocumentRow) {
    if (!(await confirm({ title: `Apagar "${doc.name}"?`, description: "Esta ação não pode ser desfeita.", confirmLabel: "Apagar", danger: true }))) return;
    startTransition(async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        setError("Falha ao apagar documento.");
      }
    });
  }

  return (
    <section className="bg-white border border-n100 rounded-xl p-6">
      {dialog}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-n400" />
            Documentos internos
          </h2>
          <p className="text-sm text-n500 mt-0.5">
            Arquivos anexados a este veículo. Visíveis só para a equipe da loja.
          </p>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-n50 border border-n100 rounded-lg p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-n600 mb-1.5">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="w-full rounded-md border border-n200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-n600 mb-1.5">
              Nome (opcional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={uploading}
              placeholder="Ex.: CRLV 2026"
              className="w-full rounded-md border border-n200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-signal text-white text-sm font-semibold hover:bg-signal-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Anexar arquivo
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-danger">{error}</p>
        )}
      </div>

      {/* Lista */}
      {documents.length === 0 ? (
        <p className="text-sm text-n500 py-8 text-center">
          Nenhum documento anexado ainda. CRLV, laudo, OS, NF de peças e outros arquivos
          podem ser guardados aqui.
        </p>
      ) : (
        <ul className="divide-y divide-n100">
          {documents.map((doc) => (
            <li key={doc.id} className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-n50 flex items-center justify-center text-n500 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
                <p className="text-xs text-n500 mt-0.5">
                  {CATEGORY_LABEL[doc.category] ?? doc.category} · {formatSize(doc.size)} ·{" "}
                  {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-n500 hover:bg-n50 hover:text-ink"
                title="Abrir / baixar"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={pending}
                className="p-2 rounded-md text-n500 hover:bg-danger/10 hover:text-danger disabled:opacity-50 cursor-pointer"
                title="Apagar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
