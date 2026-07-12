"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Car, MessageCircle, Palette, PlayCircle, Sparkles, Users, X } from "lucide-react";
import { OnboardingTour } from "@/components/admin/OnboardingTour";

const STEPS = [
  { icon: Palette, title: "Personalize sua marca", desc: "Cores, logo e textos do seu site.", href: "/admin/personalizar" },
  { icon: Car, title: "Cadastre seu primeiro veículo", desc: "Comece a montar sua vitrine.", href: "/admin/veiculos/novo" },
  { icon: MessageCircle, title: "Configure o WhatsApp", desc: "Para receber os contatos dos clientes.", href: "/admin/personalizar" },
  { icon: Users, title: "Acompanhe seus leads", desc: "Cada contato vira um card no funil.", href: "/admin/leads" },
] as const;

/** Tutorial de primeiros passos exibido no 1º acesso, até ser dispensado. */
export function OnboardingChecklist({ name }: { name?: string }) {
  const [hidden, setHidden] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    // Persiste no servidor (best-effort) para não reaparecer em outro device.
    fetch("/api/admin/onboarding/complete", { method: "POST" }).catch(() => {});
  }

  return (
    <div className="relative mb-6 sm:mb-8 rounded-2xl border border-n200 bg-white p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar tutorial"
        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-n400 hover:bg-n100 hover:text-ink transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-signal" />
        <h2 className="font-display text-h3 font-semibold text-ink">
          Bem-vindo{name ? `, ${name}` : ""}! 👋
        </h2>
      </div>
      <p className="mt-1 text-sm text-n600">
        Faça um tour de 1 minuto pelas funcionalidades, ou comece pelos atalhos abaixo.
      </p>

      <button
        type="button"
        onClick={() => setTourOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink hover:bg-signal-dark transition-colors cursor-pointer"
      >
        <PlayCircle className="h-4 w-4" />
        Fazer o tour guiado
      </button>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STEPS.map((s, i) => (
          <Link
            key={s.title}
            href={s.href}
            className="group flex items-start gap-3 rounded-xl border border-n200 bg-n50 p-3 hover:border-signal/50 hover:bg-white transition-colors"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-signal ring-1 ring-n200">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-ink">
                <span className="text-n400">{i + 1}.</span> {s.title}
                <ArrowRight className="h-3.5 w-3.5 text-n400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="block text-xs text-n500">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-4 text-xs font-medium text-n500 hover:text-ink transition-colors cursor-pointer"
      >
        Já configurei — não mostrar de novo
      </button>

      <OnboardingTour open={tourOpen} onOpenChange={setTourOpen} onComplete={dismiss} />
    </div>
  );
}
