"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Phone, Mail } from "lucide-react";
import type { LeadRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";

const STATUSES = ["novo", "contatado", "convertido", "perdido"] as const;
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  contatado: "Contatado",
  convertido: "Convertido",
  perdido: "Perdido",
};
const STATUS_COLOR: Record<string, string> = {
  novo: "bg-signal/10 text-signal ring-1 ring-signal",
  contatado: "bg-warning/12 text-ink ring-1 ring-warning/30",
  convertido: "bg-success/12 text-ink ring-1 ring-success/30",
  perdido: "bg-n100 text-n600 ring-1 ring-n200",
};
const SOURCE_LABEL: Record<string, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

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

  async function changeStatus(id: number, status: string) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: number) {
    if (!confirm("Excluir este lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  const counts = STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }));

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Leads</h1>
        <p className="text-sm text-n600 mt-1">
          Contatos capturados pelo site — base para campanhas de email e WhatsApp.
        </p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {counts.map(({ status, count }) => (
          <div key={status} className="bg-white rounded-xl border border-n100 p-4">
            <p className="text-2xl font-bold text-ink">{count}</p>
            <p className="text-xs text-n600 mt-0.5">{STATUS_LABEL[status]}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-6 py-4 border-b border-n100">
          <h2 className="text-sm font-semibold text-ink">Todos os leads</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-n400 text-sm">Carregando...</div>
        ) : (
          <table className="min-w-full divide-y divide-n100 text-sm">
            <thead>
              <tr className="bg-n50">
                {["Contato", "Veículo de interesse", "Origem", "Data", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-n600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-n100">
              {leads.map((lead) => {
                const vehicle = lead.vehicle_id ? vehicles[lead.vehicle_id] : undefined;
                return (
                  <tr key={lead.id} className="hover:bg-n50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{lead.name}</p>
                      <div className="flex flex-col gap-0.5 mt-1 text-xs text-n400">
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-n600">
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </a>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-n600">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </a>
                        )}
                      </div>
                      {lead.message && (
                        <p className="text-xs text-n400 mt-1 max-w-[260px]">{lead.message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-n600 whitespace-nowrap">
                      {vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-n600">{SOURCE_LABEL[lead.source] ?? lead.source}</td>
                    <td className="px-4 py-3 text-n400 whitespace-nowrap">
                      {lead.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => changeStatus(lead.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-signal ${STATUS_COLOR[lead.status]}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => remove(lead.id)}
                        className="text-n400 hover:text-danger transition-colors cursor-pointer"
                        aria-label="Excluir lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-n400 text-sm">
                    Nenhum lead capturado ainda. Eles aparecem aqui quando alguém preenche
                    o formulário &quot;Tenho interesse&quot; no site.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
