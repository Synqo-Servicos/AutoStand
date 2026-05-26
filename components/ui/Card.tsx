import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "surface" | "elevated" | "interactive";

const variants: Record<Variant, string> = {
  surface: "bg-white border border-n200 shadow-xs",
  elevated: "bg-sand border border-sand-dark shadow-sm",
  interactive: cn(
    "bg-white border border-n200 shadow-xs",
    "transition-[box-shadow,border-color,transform] duration-150 ease-out",
    "hover:shadow-md hover:border-transparent",
    "focus-within:ring-2 focus-within:ring-ink/20 focus-within:ring-offset-2",
  ),
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /** Padding shorthand — `none` para controlar manualmente nos slots. */
  padding?: "none" | "sm" | "md" | "lg";
  /** Render as `<article>` quando o card representa uma entidade. */
  as?: "div" | "article" | "section";
}

const paddings = {
  none: "",
  sm: "p-5",
  md: "p-6",
  lg: "p-8",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "surface", padding = "md", as = "div", className, children, ...rest },
  ref,
) {
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={cn("rounded-xl", variants[variant], paddings[padding], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-n100 pb-4 mb-5 last:mb-0 last:border-0 last:pb-0",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-h3 text-ink", className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-body-s text-n600", className)} {...rest} />
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-body text-ink", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-n100 pt-4 mt-5",
        className,
      )}
      {...rest}
    />
  );
}
