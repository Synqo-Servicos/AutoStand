"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import type { TenantRow } from "@/lib/schema";
import { PLAN_SLUGS, PLANS } from "@/lib/plans";
import { normalizeSlug } from "@/lib/slug";
import { useConfirm } from "@/components/ui";

interface Props {
  tenant?: TenantRow;
}

const OPTIONAL_FIELDS = [
  "custom_domain", "logo_url", "hero_title", "hero_subtitle",
  "city", "whatsapp_number", "instagram_url", "business_hours", "contact_email",
  "plan",
] as const;

export function TenantForm({ tenant }: Props) {
  const router = useRouter();
  const isEdit = !!tenant;

  const [form, setForm] = useState({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    custom_domain: tenant?.custom_domain ?? "",
    plan: tenant?.plan ?? "",
    status: tenant?.status ?? "active",
    primary_color: tenant?.primary_color ?? "#1E293B",
    accent_color: tenant?.accent_color ?? "#DC2626",
    accent_dark_color: tenant?.accent_dark_color ?? "#B91C1C",
    logo_url: tenant?.logo_url ?? "",
    hero_title: tenant?.hero_title ?? "",
    hero_subtitle: tenant?.hero_subtitle ?? "",
    city: tenant?.city ?? "",
    whatsapp_number: tenant?.whatsapp_number ?? "",
    instagram_url: tenant?.instagram_url ?? "",
    business_hours: tenant?.business_hours ?? "",
    contact_email: tenant?.contact_email ?? "",
  });
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onNameChange(value: string) {
    setForm((f) => ({
      ...f,
      name: value,
      slug: slugTouched ? f.slug : normalizeSlug(value),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = { ...form };
    for (const key of OPTIONAL_FIELDS) {
      if (payload[key] === "") payload[key] = null;
    }
    if (!isEdit) {
      payload.admin = admin;
    }

    const res = await fetch(
      isEdit ? `/api/superadmin/tenants/${tenant.id}` : "/api/superadmin/tenants",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao salvar");
      setLoading(false);
      return;
    }

    router.push("/superadmin/tenants");
    router.refresh();
  }

  const { confirm, dialog } = useConfirm();

  async function handleDelete() {
    if (!tenant) return;
    const ok = await confirm({
      title: `Excluir "${tenant.name}"?`,
      description: "Todos os veículos, leads e usuários serão removidos.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    await fetch(`/api/superadmin/tenants/${tenant.id}`, { method: "DELETE" });
    router.push("/superadmin/tenants");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {dialog}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Identificação */}
      <Section title="Identificação" desc="Nome e endereço da concessionária na plataforma.">
        <Field label="Nome da concessionária" required>
          <input
            required
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            className={inputClass}
            placeholder="Ex: Auto Brasil Veículos"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slug" hint="Identificador único — vira o subdomínio do site: <slug>.autostand.com.br" required>
            <input
              required
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", normalizeSlug(e.target.value));
              }}
              className={inputClass}
              placeholder="auto-brasil"
            />
          </Field>
          <Field label="Domínio próprio" hint="Domínio próprio do cliente (opcional). O DNS deve apontar para a plataforma.">
            <input
              value={form.custom_domain}
              onChange={(e) => set("custom_domain", e.target.value.trim())}
              className={inputClass}
              placeholder="concessionaria.com.br"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Plano" hint="Define as capabilities. Vazio = capabilities do Básico.">
            <select
              value={form.plan}
              onChange={(e) => set("plan", e.target.value)}
              className={inputClass}
            >
              <option value="">Sem plano definido</option>
              {PLAN_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {PLANS[slug].name}
                </option>
              ))}
            </select>
          </Field>
          {isEdit && (
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputClass}
              >
                <option value="active">Ativa</option>
                <option value="suspended">Suspensa</option>
              </select>
            </Field>
          )}
        </div>
      </Section>

      {/* Branding */}
      <Section title="Identidade visual" desc="Cores e textos aplicados ao site do cliente.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Cor primária" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
          <ColorField label="Cor de destaque" value={form.accent_color} onChange={(v) => set("accent_color", v)} />
          <ColorField label="Destaque (escuro)" value={form.accent_dark_color} onChange={(v) => set("accent_dark_color", v)} />
        </div>
        <Field label="URL do logo" hint="Opcional. Imagem hospedada.">
          <input
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value.trim())}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título do hero">
            <input
              value={form.hero_title}
              onChange={(e) => set("hero_title", e.target.value)}
              className={inputClass}
              placeholder="Seminovos com procedência"
            />
          </Field>
          <Field label="Subtítulo do hero">
            <input
              value={form.hero_subtitle}
              onChange={(e) => set("hero_subtitle", e.target.value)}
              className={inputClass}
              placeholder="Carros revisados e documentação em dia"
            />
          </Field>
        </div>
      </Section>

      {/* Contato */}
      <Section title="Contato" desc="Dados exibidos no site público.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cidade">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} placeholder="Maceió, AL" />
          </Field>
          <Field label="WhatsApp" hint="Com DDI (55) + DDD + número. Ex: 5511999998888">
            <input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))} className={inputClass} placeholder="5582999999999" />
          </Field>
          <Field label="Instagram (URL)">
            <input value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value.trim())} className={inputClass} placeholder="https://instagram.com/..." />
          </Field>
          <Field label="Email de contato">
            <input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value.trim())} className={inputClass} placeholder="contato@..." />
          </Field>
        </div>
        <Field label="Horário de funcionamento">
          <input value={form.business_hours} onChange={(e) => set("business_hours", e.target.value)} className={inputClass} placeholder="Seg–Sex: 8h às 18h" />
        </Field>
      </Section>

      {/* Admin (create only) */}
      {!isEdit && (
        <Section
          title="Administrador da concessionária"
          desc="Credenciais de acesso ao painel do cliente. Você pode pular e criar depois."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nome">
              <input value={admin.name} onChange={(e) => setAdmin((a) => ({ ...a, name: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Email">
              <input type="email" value={admin.email} onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value.trim() }))} className={inputClass} />
            </Field>
            <Field label="Senha provisória" hint="O lojista é obrigado a trocá-la no 1º login.">
              <input type="text" value={admin.password} onChange={(e) => setAdmin((a) => ({ ...a, password: e.target.value }))} className={inputClass} placeholder="ex: autostand2026" />
            </Field>
          </div>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center gap-2 text-sm font-medium text-danger hover:bg-danger/10 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Excluir concessionária
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center gap-2 bg-signal text-ink text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-signal-dark disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Cadastrar concessionária"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent transition-shadow";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-n200/70 p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="text-xs text-n400 mt-0.5">{desc}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-n600 mb-1">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-n400 mt-1">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-n600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-n200 cursor-pointer bg-white p-0.5"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
