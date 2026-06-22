"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight, ArrowRight, Car, FileText, Camera, LayoutDashboard,
  PiggyBank, Palette, Sparkles, Store, UserCircle2, Users,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/** Mapa das abas do painel (espelha o AdminSidebar) — passo de visão geral. */
const TAB_MAP = [
  { group: "Operação", tabs: ["Dashboard", "Veículos", "Documentos"] },
  { group: "Vendas", tabs: ["Leads", "Transações", "Vendedores", "Financeiro"] },
  { group: "Marketing", tabs: ["Marketplace", "Personalizar", "Análise IA", "Inteligência"] },
  { group: "Conta", tabs: ["Assinatura"] },
];

const GESTAO = [
  { icon: PiggyBank, label: "Financeiro", desc: "Custo, receita e margem do mês — sem planilha." },
  { icon: ArrowLeftRight, label: "Transações", desc: "Entradas (compras) e saídas (vendas); a comissão do vendedor é gerada automática." },
  { icon: UserCircle2, label: "Vendedores", desc: "Cadastre a equipe e as regras de comissão." },
  { icon: FileText, label: "Documentos", desc: "Gere contratos e recibos em PDF prontos pra assinar." },
];

type Step = {
  icon: typeof Car;
  title: string;
  lead: string;
  badge?: string;
  flow?: string[];
  ctas?: { href: string; label: string }[];
  variant?: "tabs" | "gestao";
};

const STEPS: Step[] = [
  {
    icon: LayoutDashboard,
    title: "Bem-vindo ao seu painel",
    lead: "Tudo para vender mais fica em 4 áreas no menu lateral. Em 1 minuto você conhece cada uma.",
    variant: "tabs",
  },
  {
    icon: Car,
    title: "Cadastrar um veículo",
    lead: "O coração da loja. Cadastrou, já aparece na sua vitrine.",
    flow: [
      "Abra Veículos → Novo veículo.",
      "Preencha marca, modelo, versão, ano, km e preço.",
      "Marque os destaques (único dono, blindado, opcionais).",
      "Adicione as fotos — a primeira vira a capa.",
      "Salve: o carro entra na sua vitrine na hora.",
    ],
    ctas: [{ href: "/admin/veiculos/novo", label: "Cadastrar um veículo" }],
  },
  {
    icon: Camera,
    title: "Gerar post de Instagram",
    lead: "Uma arte pronta + legenda escrita por IA, com a sua marca — sem designer.",
    badge: "Plano Pro",
    flow: [
      "Em Veículos, abra um carro que já tenha foto.",
      "Clique em Gerar post.",
      "Sai uma imagem 1080×1080 com as suas cores e a legenda escrita por IA.",
      "Edite a legenda se quiser, baixe e poste no seu Instagram.",
    ],
    ctas: [{ href: "/admin/veiculos", label: "Ver meus veículos" }],
  },
  {
    icon: Users,
    title: "Leads e WhatsApp",
    lead: "Cada interesse no seu site vira um lead — e você responde em 1 clique.",
    flow: [
      "Quem preenche \"tenho interesse\" no site/marketplace vira um lead no funil.",
      "Responda pelo WhatsApp em 1 clique, com mensagem pronta.",
      "Mova o lead pelos estágios: novo → contatado → negociando → convertido.",
      "Cada contato fica registrado no histórico do lead.",
    ],
    ctas: [{ href: "/admin/leads", label: "Abrir o funil de leads" }],
  },
  {
    icon: PiggyBank,
    title: "Gestão da loja",
    lead: "Controle o dinheiro, a equipe e os documentos — tudo num lugar.",
    variant: "gestao",
    ctas: [
      { href: "/admin/financeiro", label: "Financeiro" },
      { href: "/admin/transacoes", label: "Transações" },
    ],
  },
  {
    icon: Palette,
    title: "Sua marca e divulgação",
    lead: "Deixe o site com a sua cara e alcance mais compradores.",
    flow: [
      "Personalizar: cores, logo, textos e a seção \"Sobre\" do seu site.",
      "Marketplace: apareça na rede AutoStand (opcional, em todos os planos).",
      "Análise IA e Inteligência (Premium): recomendações da vitrine e o que o mercado procura.",
      "Assinatura: acompanhe seu plano e status.",
    ],
    ctas: [
      { href: "/admin/personalizar", label: "Personalizar minha loja" },
      { href: "/admin/marketplace", label: "Marketplace" },
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário conclui o tour. */
  onComplete: () => void;
}

export function OnboardingTour({ open, onOpenChange, onComplete }: Props) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const Icon = step.icon;

  function close(complete: boolean) {
    if (complete) onComplete();
    onOpenChange(false);
    // Reseta para reabrir do início numa próxima vez.
    setTimeout(() => setI(0), 200);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close(false))}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-signal" />
          {step.title}
          {step.badge && (
            <span className="rounded-full bg-signal/10 px-2 py-0.5 text-[11px] font-semibold text-signal">
              {step.badge}
            </span>
          )}
        </span>
      }
      description={step.lead}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-signal" : "w-1.5 bg-n200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((v) => v - 1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-n600 hover:bg-n100 transition-colors cursor-pointer"
              >
                Anterior
              </button>
            )}
            {last ? (
              <button
                type="button"
                onClick={() => close(true)}
                className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink hover:bg-signal-dark transition-colors cursor-pointer"
              >
                Concluir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setI((v) => v + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink hover:bg-signal-dark transition-colors cursor-pointer"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      }
    >
      {step.variant === "tabs" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TAB_MAP.map((g) => (
            <div key={g.group} className="rounded-xl border border-n200 bg-n50 p-3">
              <p className="text-eyebrow text-n500 mb-1.5">{g.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.tabs.map((t) => (
                  <span key={t} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-ink ring-1 ring-n200">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : step.variant === "gestao" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GESTAO.map((g) => (
            <div key={g.label} className="flex items-start gap-3 rounded-xl border border-n200 bg-n50 p-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-signal ring-1 ring-n200">
                <g.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{g.label}</span>
                <span className="block text-xs text-n600">{g.desc}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ol className="space-y-2.5">
          {step.flow?.map((f, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-bold text-signal">
                {idx + 1}
              </span>
              <span className="text-sm text-n700 pt-0.5">{f}</span>
            </li>
          ))}
        </ol>
      )}

      {step.ctas && step.ctas.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-n100 pt-4">
          {step.ctas.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-n200 bg-white px-3 py-2 text-sm font-medium text-ink hover:border-signal/50 hover:bg-n50 transition-colors"
            >
              {c.label}
              <ArrowRight className="h-3.5 w-3.5 text-n400" />
            </Link>
          ))}
        </div>
      )}
    </Modal>
  );
}
