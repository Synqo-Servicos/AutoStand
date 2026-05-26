import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tonalidades semânticas — sempre `bg-{cor}/12` + `text-{cor}-dark` + `ring-{cor}/30`.
 * Nunca texto branco sobre cor sólida (regra de contraste do SPEC §2.1.4).
 */
type Tone =
  | "neutral"
  | "available"
  | "pending"
  | "sold"
  | "suspended"
  | "highlight"
  | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-n100 text-n700 ring-1 ring-inset ring-n200",
  available: "bg-success/12 text-success-dark ring-1 ring-inset ring-success/30",
  pending: "bg-warning/15 text-warning-dark ring-1 ring-inset ring-warning/30",
  sold: "bg-n200 text-n700 ring-1 ring-inset ring-n300",
  suspended: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/30",
  highlight: "bg-signal/12 text-ink ring-1 ring-inset ring-signal/30",
  info: "bg-ink/8 text-ink ring-1 ring-inset ring-ink/15",
};

type Size = "sm" | "md";

const sizes: Record<Size, string> = {
  sm: "text-[11px] px-1.5 py-0.5 gap-1",
  md: "text-body-s px-2 py-0.5 gap-1.5",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  /** Ponto colorido antes do label (estilo "status indicator"). */
  dot?: boolean;
  /** Ícone opcional à esquerda. */
  icon?: ReactNode;
}

const dotColors: Record<Tone, string> = {
  neutral: "bg-n500",
  available: "bg-success",
  pending: "bg-warning",
  sold: "bg-n500",
  suspended: "bg-danger",
  highlight: "bg-signal",
  info: "bg-ink",
};

export function Badge({
  tone = "neutral",
  size = "md",
  dot,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        sizes[size],
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}
