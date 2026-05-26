import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "text" | "circle" | "rect" | "card";

const base = cn(
  "relative overflow-hidden bg-n150",
  // Shimmer via gradient deslizante; respeita prefers-reduced-motion via globals.
  "before:absolute before:inset-0",
  "before:bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)]",
  "before:animate-[shimmer_1.5s_infinite]",
);

const variantClasses: Record<Variant, string> = {
  text: "h-3.5 rounded-sm",
  circle: "rounded-full aspect-square",
  rect: "rounded-md",
  card: "rounded-xl",
};

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /** Largura em qualquer unidade CSS (`'80%'`, `'12rem'`); padrão deixa o pai decidir. */
  width?: string | number;
  /** Altura idem; obrigatório em `rect` e `card`. */
  height?: string | number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      data-loading
      className={cn(base, variantClasses[variant], className)}
      style={{
        width,
        height,
        ...style,
      }}
      {...rest}
    />
  );
}

/** Combinador comum: bloco de N linhas de skeleton text. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}
