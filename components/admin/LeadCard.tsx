"use client";

import { useState } from "react";
import { Phone, Mail, MessageCircle, Trash2, Clock, ChevronDown, History } from "lucide-react";
import type { LeadRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";
import { LEAD_STAGES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { LeadHistoryDrawer } from "@/components/admin/LeadHistoryDrawer";
import { waHref } from "@/lib/whatsapp";

function buildTemplates(name: string, vehicleLabel: string | null) {
  const carro = vehicleLabel ? `o ${vehicleLabel}` : "um dos nossos veículos";
  const first = name.trim().split(/\s+/)[0] || name;
  return [
    {
      key: "saudacao",
      label: "Saudação",
      text: `Olá, ${first}! Vi que você demonstrou interesse em ${carro}. Posso te ajudar?`,
    },
    {
      key: "followup",
      label: "Follow-up",
      text: `Olá, ${first}, tudo bem? Passando para saber se você ainda tem interesse em ${carro}. Fico à disposição!`,
    },
    {
      key: "testdrive",
      label: "Agendar test-drive",
      text: `Olá, ${first}! Que tal agendar um test-drive ${vehicleLabel ? `do ${vehicleLabel}` : "de um veículo"}? Me diga um dia e horário que funcionem para você.`,
    },
  ];
}

interface Props {
  lead: LeadRow;
  vehicle?: Vehicle;
  stale: boolean;
  onStatusChange: (id: number, status: string) => void;
  onContacted: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Card de lead no funil — dados do contato + ações (WhatsApp, estágio). */
export function LeadCard({ lead, vehicle, stale, onStatusChange, onContacted, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : null;
  const templates = buildTemplates(lead.name, vehicleLabel);
  function sendWhatsApp(text: string, label: string) {
    const href = waHref(lead.phone, text);
    if (href) window.open(href, "_blank", "noopener");
    setMenuOpen(false);
    // Registra no histórico do lead (best-effort — não bloqueia o envio).
    fetch(`/api/leads/${lead.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "whatsapp", body: `Mensagem enviada (${label})` }),
    }).catch(() => {});
    if (lead.status === "novo") onContacted(lead.id);
  }

  return (
    <div className="rounded-xl border border-n200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-ink leading-tight">{lead.name}</p>
        {stale && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
            <Clock className="h-2.5 w-2.5" />
            sem contato
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-n500">
        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
          <Phone className="h-3 w-3" />
          {lead.phone}
        </a>
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-ink">
            <Mail className="h-3 w-3" />
            {lead.email}
          </a>
        )}
      </div>

      <p className="mt-2 text-xs text-n600">
        {vehicleLabel ?? "Sem veículo específico"}
      </p>
      {lead.message && (
        <p className="mt-1 line-clamp-2 text-xs text-n400">{lead.message}</p>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-n400">
        <span>{LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS] ?? lead.source}</span>
        <span>·</span>
        <span>{lead.created_at.slice(0, 10)}</span>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-n500 hover:bg-n100 hover:text-ink transition-colors cursor-pointer"
        >
          <History className="h-3 w-3" />
          Histórico
        </button>
      </div>

      {/* Ações */}
      <div className="mt-3 flex items-center gap-1.5">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-success/90 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success cursor-pointer"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
            <ChevronDown className="h-3 w-3" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-n200 bg-white shadow-lg">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => sendWhatsApp(t.text, t.label)}
                    className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-n50 transition-colors cursor-pointer"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <select
          value={lead.status}
          onChange={(e) => onStatusChange(lead.id, e.target.value)}
          aria-label="Estágio do lead"
          className="rounded-lg border border-n200 bg-white px-1.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-signal cursor-pointer"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDelete(lead.id)}
          className="rounded-lg p-1.5 text-n400 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
          aria-label="Excluir lead"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <LeadHistoryDrawer lead={lead} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
