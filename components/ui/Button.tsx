"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base = cn(
  "inline-flex items-center justify-center gap-2 font-medium",
  "rounded-md select-none whitespace-nowrap",
  "transition-[background-color,color,border-color,box-shadow,transform]",
  "duration-150 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "active:scale-[0.98]",
  "disabled:opacity-50 disabled:pointer-events-none",
);

const variants: Record<Variant, string> = {
  primary: cn(
    "bg-signal text-ink shadow-xs",
    "hover:bg-signal-dark hover:shadow-sm",
    "focus-visible:ring-signal/40",
  ),
  secondary: cn(
    "bg-ink text-white shadow-xs",
    "hover:bg-ink-700 hover:shadow-sm",
    "focus-visible:ring-ink/30",
  ),
  outline: cn(
    "border border-n300 bg-transparent text-ink",
    "hover:bg-n50 hover:border-n400",
    "focus-visible:ring-ink/30",
  ),
  ghost: cn(
    "bg-transparent text-ink",
    "hover:bg-n100",
    "focus-visible:ring-ink/30",
  ),
  danger: cn(
    "bg-danger text-white shadow-xs",
    "hover:bg-danger/90 hover:shadow-sm",
    "focus-visible:ring-danger/40",
  ),
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-body-s",
  md: "h-10 px-4 text-body-s",
  lg: "h-12 px-6 text-body",
};

const iconOnlySizes: Record<Size, string> = {
  sm: "h-9 w-9 px-0",
  md: "h-10 w-10 px-0",
  lg: "h-12 w-12 px-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconOnly = false,
    leadingIcon,
    trailingIcon,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      className={cn(
        base,
        variants[variant],
        iconOnly ? iconOnlySizes[size] : sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        leadingIcon
      )}
      {!iconOnly && children}
      {!loading && trailingIcon}
    </button>
  );
});
