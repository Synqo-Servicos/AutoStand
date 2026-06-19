"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft, FileText, Mail, MapPin, MessageCircle, Phone, StickyNote,
} from "lucide-react";
import type { LeadInteractionRow, LeadRow } from "@/lib/schema";
import { Drawer } from "@/components/ui/Drawer";
import {
  LEAD_INTERACTION_LABELS, LEAD_INTERACTION_MANUAL_TYPES, LEAD_STAGES,
  type LeadInteractionType,
} from "@/lib/constants";

const ICONS: Record<LeadInteractionType, typeof StickyNote> = {
  nota: StickyNote,
  ligacao: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visita: MapPin,
  proposta: FileText,
  mudanca_status: ArrowRightLeft,
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_STAGES.map((s) => [s.key, s.label]),
);

/** "2026-06-19 20:51:09" → "19/06 20:51". */
function fmt(ts: string): string {
  const [date, time] = ts.replace("T", " ").split(" ");
  if (!date) return ts;
  const [, m, d] = date.split("-");
  return `${d}/${m}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

function summary(it: LeadInteractionRow): string {
  if (it.type === "mudanca_status") {
    const meta = (it.metadata ?? {}) as { from?: string; to?: string };
    const from = STAGE_LABEL[meta.from ?? ""] ?? meta.from ?? "?";
    const to = STAGE_LABEL[meta.to ?? ""] ?? meta.to ?? "?";
    return `${from} → ${to}`;
  }
  return it.body ?? "";
}

interface Props {
  lead: LeadRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadHistoryDrawer({ lead, open, onOpenChange }: Props) {
  const [items, setItems] = useState<LeadInteractionRow[] | null>(null);
  const [type, setType] = useState<LeadInteractionType>("nota");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    fetch(`/api/leads/${lead.id}/interactions`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [open, lead.id]);

  async function addNote() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body: text }),
      });
      if (res.ok) {
        const row: LeadInteractionRow = await res.json();
        setItems((prev) => [row, ...(prev ?? [])]);
        setBody("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={`Histórico — ${lead.name}`}
      description="Linha do tempo de contatos com este lead"
    >
      {/* Form de nota rápida */}
      <div className="rounded-xl border border-n200 bg-n50 p-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LeadInteractionType)}
          aria-label="Tipo de interação"
          className="mb-2 w-full rounded-lg border border-n200 bg-white px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-signal cursor-pointer"
        >
          {LEAD_INTERACTION_MANUAL_TYPES.map((t) => (
            <option key={t} value={t}>{LEAD_INTERACTION_LABELS[t]}</option>
          ))}
        </select>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Descreva o contato (ex.: ligou, vai pensar até sexta)…"
          rows={2}
          maxLength={2000}
          className="w-full resize-none rounded-lg border border-n200 bg-white px-2.5 py-2 text-sm text-ink placeholder:text-n400 focus:outline-none focus:ring-2 focus:ring-signal"
        />
        <button
          type="button"
          onClick={addNote}
          disabled={saving || body.trim().length === 0}
          className="mt-2 w-full rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink-700 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Registrando…" : "Registrar interação"}
        </button>
      </div>

      {/* Timeline */}
      <div className="mt-5">
        {items === null ? (
          <p className="py-8 text-center text-xs text-n400">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-xs text-n400">
            Nenhuma interação ainda. Mudanças de estágio e contatos aparecem aqui.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((it) => {
              const Icon = ICONS[it.type as LeadInteractionType] ?? StickyNote;
              const label = LEAD_INTERACTION_LABELS[it.type as LeadInteractionType] ?? it.type;
              return (
                <li key={it.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-n100 text-n600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-ink">{label}</span>
                      <span className="shrink-0 text-[11px] text-n400">{fmt(it.created_at)}</span>
                    </div>
                    {summary(it) && (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-n600">
                        {summary(it)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
