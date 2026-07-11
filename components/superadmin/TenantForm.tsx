"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { TenantRow } from "@/lib/schema";
import { PLAN_SLUGS, PLANS } from "@/lib/plans";
import { normalizeSlug } from "@/lib/slug";
import { Button, Field, Input, Select, useConfirm } from "@/components/ui";

interface Props {
  tenant?: TenantRow;
}

const OPTIONAL_FIELDS = [
  "custom_domain", "logo_url", "hero_title", "hero_subtitle",
  "city", "whatsapp_number", "instagram_url", "business_hours", "contact_email",
  "plan",
] as const;

const NO_PLAN = "__none__";

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
          {(f) => (
            <Input
              id={f.id}
              required
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Auto Brasil Veículos"
            />
          )}
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Slug"
            required
            helperText="Identificador único — vira o subdomínio do site: <slug>.autostand.com.br"
          >
            {(f) => (
              <Input
                id={f.id}
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", normalizeSlug(e.target.value));
                }}
                placeholder="auto-brasil"
              />
            )}
          </Field>
          <Field
            label="Domínio próprio"
            helperText="Domínio próprio do cliente (opcional). O DNS deve apontar para a plataforma."
          >
            {(f) => (
              <Input
                id={f.id}
                value={form.custom_domain}
                onChange={(e) => set("custom_domain", e.target.value.trim())}
                placeholder="concessionaria.com.br"
              />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Plano" helperText="Define as capabilities. Vazio = capabilities do Básico.">
            {(f) => (
              <Select
                id={f.id}
                value={form.plan || NO_PLAN}
                onValueChange={(v) => set("plan", v === NO_PLAN ? "" : v)}
                options={[
                  { value: NO_PLAN, label: "Sem plano definido" },
                  ...PLAN_SLUGS.map((slug) => ({ value: slug, label: PLANS[slug].name })),
                ]}
              />
            )}
          </Field>
          {isEdit && (
            <Field label="Status">
              {(f) => (
                <Select
                  id={f.id}
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                  options={[
                    { value: "active", label: "Ativa" },
                    { value: "suspended", label: "Suspensa" },
                  ]}
                />
              )}
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
        <Field label="URL do logo" helperText="Opcional. Imagem hospedada.">
          {(f) => (
            <Input
              id={f.id}
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value.trim())}
              placeholder="https://..."
            />
          )}
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título do hero">
            {(f) => (
              <Input
                id={f.id}
                value={form.hero_title}
                onChange={(e) => set("hero_title", e.target.value)}
                placeholder="Seminovos com procedência"
              />
            )}
          </Field>
          <Field label="Subtítulo do hero">
            {(f) => (
              <Input
                id={f.id}
                value={form.hero_subtitle}
                onChange={(e) => set("hero_subtitle", e.target.value)}
                placeholder="Carros revisados e documentação em dia"
              />
            )}
          </Field>
        </div>
      </Section>

      {/* Contato */}
      <Section title="Contato" desc="Dados exibidos no site público.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cidade">
            {(f) => (
              <Input
                id={f.id}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Maceió, AL"
              />
            )}
          </Field>
          <Field label="WhatsApp" helperText="Com DDI (55) + DDD + número. Ex: 5511999998888">
            {(f) => (
              <Input
                id={f.id}
                value={form.whatsapp_number}
                onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))}
                placeholder="5582999999999"
              />
            )}
          </Field>
          <Field label="Instagram (URL)">
            {(f) => (
              <Input
                id={f.id}
                value={form.instagram_url}
                onChange={(e) => set("instagram_url", e.target.value.trim())}
                placeholder="https://instagram.com/..."
              />
            )}
          </Field>
          <Field label="Email de contato">
            {(f) => (
              <Input
                id={f.id}
                type="email"
                value={form.contact_email}
                onChange={(e) => set("contact_email", e.target.value.trim())}
                placeholder="contato@..."
              />
            )}
          </Field>
        </div>
        <Field label="Horário de funcionamento">
          {(f) => (
            <Input
              id={f.id}
              value={form.business_hours}
              onChange={(e) => set("business_hours", e.target.value)}
              placeholder="Seg–Sex: 8h às 18h"
            />
          )}
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
              {(f) => (
                <Input
                  id={f.id}
                  value={admin.name}
                  onChange={(e) => setAdmin((a) => ({ ...a, name: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Email">
              {(f) => (
                <Input
                  id={f.id}
                  type="email"
                  value={admin.email}
                  onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value.trim() }))}
                />
              )}
            </Field>
            <Field label="Senha provisória" helperText="O lojista é obrigado a trocá-la no 1º login.">
              {(f) => (
                <Input
                  id={f.id}
                  type="text"
                  value={admin.password}
                  onChange={(e) => setAdmin((a) => ({ ...a, password: e.target.value }))}
                  placeholder="ex: autostand2026"
                />
              )}
            </Field>
          </div>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
        {isEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={loading}
            leadingIcon={<Trash2 className="w-4 h-4" />}
            className="w-full sm:w-auto text-danger hover:border-danger/40 hover:bg-danger/10"
          >
            Excluir concessionária
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          {isEdit ? "Salvar alterações" : "Cadastrar concessionária"}
        </Button>
      </div>
    </form>
  );
}

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
    <div className="bg-white rounded-xl border border-n200 shadow-xs p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="text-xs text-n400 mt-0.5">{desc}</p>
      </div>
      <div className="space-y-4">{children}</div>
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
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-eyebrow text-n700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-9 h-9 rounded-md border border-n300 cursor-pointer bg-white p-0.5"
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
