"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { LeadRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";
import { LeadCard, LEAD_STAGES } from "@/components/admin/LeadCard";

const STALE_DAYS = 2;

/** True quando um lead `novo` está há mais de STALE_DAYS sem contato. */
function isStale(lead: LeadRow): boolean {
  if (lead.status !== "novo") return false;
  const created = new Date(lead.created_at.replace(" ", "T")).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created > STALE_DAYS * 86_400_000;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [vehicles, setVehicles] = useState<Record<number, Vehicle>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [leadList, vehicleList] = await Promise.all([
      fetch("/api/leads").then((r) => r.json()),
      fetch("/api/vehicles").then((r) => r.json()),
    ]);
    setLeads(leadList);
    const map: Record<number, Vehicle> = {};
    for (const v of vehicleList as Vehicle[]) map[v.id] = v;
    setVehicles(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function changeStatus(id: number, status: string) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: number) {
    if (!confirm("Excluir este lead?")) return;
    setLeads((ls) => ls.filter((l) => l.id !== id));
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
  }

  const total = leads.length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const emAberto = leads.filter((l) => ["novo", "contatado", "negociando"].includes(l.status)).length;
  const fechados = leads.filter((l) => ["convertido", "perdido"].includes(l.status)).length;
  const taxa = fechados > 0 ? Math.round((convertidos / fechados) * 100) : null;
  const staleCount = leads.filter(isStale).length;

  const metrics = [
    { label: "Total de leads", value: String(total) },
    { label: "Em aberto", value: String(emAberto) },
    { label: "Convertidos", value: String(convertidos) },
    { label: "Taxa de conversão", value: taxa === null ? "—" : `${taxa}%` },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Funil de leads</h1>
        <p className="text-sm text-n600 mt-1">
          Acompanhe cada contato por estágio e dê retorno pelo WhatsApp em um clique.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-n100 p-4">
            <p className="text-2xl font-bold text-ink">{m.value}</p>
            <p className="text-xs text-n600 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Lembrete de follow-up */}
      {staleCount > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-warning/15 border border-warning/40 px-4 py-3 text-sm text-ink">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {staleCount}{" "}
            {staleCount === 1 ? "lead novo está" : "leads novos estão"} há mais de{" "}
            {STALE_DAYS} dias sem contato — vale dar um retorno.
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-n400 text-sm">Carregando...</div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-n100 bg-white py-16 text-center text-n400 text-sm">
          Nenhum lead capturado ainda. Eles aparecem aqui quando alguém preenche o
          formulário &quot;Tenho interesse&quot; no site ou no marketplace.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.status === stage.key);
            return (
              <div key={stage.key} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs font-medium text-n400">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      vehicle={lead.vehicle_id ? vehicles[lead.vehicle_id] : undefined}
                      stale={isStale(lead)}
                      onStatusChange={changeStatus}
                      onContacted={(id) => changeStatus(id, "contatado")}
                      onDelete={remove}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed border-n200 py-8 text-center text-xs text-n400">
                      Nenhum lead aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
