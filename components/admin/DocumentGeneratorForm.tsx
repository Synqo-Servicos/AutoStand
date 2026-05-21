"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Save } from "lucide-react";
import type { FieldDef, TemplateId } from "@/lib/document-templates";

type FormValues = Record<string, string | boolean>;

function defaultsFor(fields: FieldDef[]): FormValues {
  const todayIso = new Date().toISOString().slice(0, 10);
  const out: FormValues = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      out[f.key] = Boolean(f.defaultValue ?? false);
    } else if (f.type === "date") {
      out[f.key] = (f.defaultValue as string) || todayIso;
    } else if (f.defaultValue !== undefined) {
      out[f.key] = String(f.defaultValue);
    } else {
      out[f.key] = "";
    }
  }
  return out;
}

export function DocumentGeneratorForm({
  templateId,
  templateName,
  fields,
  requiresVehicle,
  vehicles,
}: {
  templateId: TemplateId;
  templateName: string;
  fields: FieldDef[];
  requiresVehicle: boolean;
  vehicles: { id: number; label: string }[];
}) {
  const [values, setValues] = useState<FormValues>(() => defaultsFor(fields));
  const [vehicleId, setVehicleId] = useState<number | "">(
    requiresVehicle && vehicles[0] ? vehicles[0].id : "",
  );
  const [busy, setBusy] = useState<null | "preview" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; url: string } | null>(null);

  function set(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(mode: "preview" | "save") {
    setError(null);
    setSaved(null);
    setBusy(mode);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          vehicleId: requiresVehicle ? (vehicleId === "" ? null : vehicleId) : null,
          formData: values,
          attachToVehicle: mode === "save",
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Falha ao gerar documento");
      }

      if (mode === "save") {
        const data = (await res.json()) as { document: { name: string; url: string }; url: string };
        setSaved({ name: data.document.name, url: data.url });
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  const canSave = requiresVehicle && vehicleId !== "";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("preview");
      }}
    >
      {requiresVehicle && (
        <section className="bg-white border border-n100 rounded-xl p-5">
          <label className="block text-xs font-semibold text-n600 uppercase tracking-wider mb-2">
            Veículo do estoque
          </label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-md border border-n200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40"
          >
            {vehicles.length === 0 ? (
              <option value="">Nenhum veículo cadastrado ainda</option>
            ) : (
              vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))
            )}
          </select>
          <p className="text-xs text-n500 mt-2">
            Marca, modelo, ano, cor e quilometragem entram automaticamente no documento.
          </p>
        </section>
      )}

      <section className="bg-white border border-n100 rounded-xl p-5">
        <p className="text-xs font-semibold text-n600 uppercase tracking-wider mb-4">
          Dados do documento
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.span === 2 ? "sm:col-span-2" : undefined}>
              <FieldInput field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-success/10 border border-success/30 px-4 py-3 rounded-md text-sm">
          <p className="font-semibold text-success">Salvo no veículo.</p>
          <p className="text-n600 mt-1">
            "{saved.name}" anexado em <strong>Documentos internos</strong>.{" "}
            <a href={saved.url} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">
              Abrir PDF
            </a>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy !== null || (requiresVehicle && vehicles.length === 0)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-signal text-white text-sm font-semibold hover:bg-signal-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Gerar PDF (abrir/baixar)
        </button>
        {requiresVehicle && (
          <button
            type="button"
            disabled={busy !== null || !canSave}
            onClick={() => submit("save")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-n200 bg-white text-ink text-sm font-semibold hover:bg-n50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Gerar e anexar ao veículo
          </button>
        )}
      </div>

      <p className="text-xs text-n500">
        O PDF gerado tem a marca <span className="font-semibold">{templateName.toLowerCase().includes("checklist") ? "interna da loja" : "da concessionária"}</span>. Os dados informados aqui são usados só para gerar este documento.
      </p>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const base = "w-full rounded-md border border-n200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40";

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-ink py-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-n300 text-signal focus:ring-signal/40"
        />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-n600 mb-1.5">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${base} resize-y`}
        />
      ) : field.type === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "money" ? "text" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "money" ? "0,00" : field.placeholder}
          className={base}
        />
      )}
      {field.hint && <p className="text-xs text-n500 mt-1">{field.hint}</p>}
    </div>
  );
}
