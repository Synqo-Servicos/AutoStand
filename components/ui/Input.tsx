"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const baseField = cn(
  "w-full bg-white text-ink placeholder:text-n400",
  "border border-n300 rounded-md",
  "transition-[border-color,box-shadow] duration-150 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-0 focus-visible:border-ink",
  "disabled:bg-n50 disabled:text-n500 disabled:cursor-not-allowed",
  "data-[invalid=true]:border-danger data-[invalid=true]:focus-visible:ring-danger/30",
);

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-body-s",
  md: "h-10 px-3 text-body-s",
  lg: "h-12 px-4 text-body",
};

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: Size;
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", invalid, leadingIcon, trailingIcon, className, ...rest },
  ref,
) {
  if (!leadingIcon && !trailingIcon) {
    return (
      <input
        ref={ref}
        data-invalid={invalid || undefined}
        className={cn(baseField, sizes[size], className)}
        {...rest}
      />
    );
  }
  return (
    <div className="relative">
      {leadingIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-n500">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        data-invalid={invalid || undefined}
        className={cn(
          baseField,
          sizes[size],
          leadingIcon && "pl-10",
          trailingIcon && "pr-10",
          className,
        )}
        {...rest}
      />
      {trailingIcon && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-n500">
          {trailingIcon}
        </span>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-invalid={invalid || undefined}
      className={cn(baseField, "min-h-24 py-3 px-3 text-body-s leading-relaxed", className)}
      {...rest}
    />
  );
});

/**
 * Wrapper para um campo de form: label + input/textarea/select + helper/error.
 * Usar com `htmlFor`/`id` automáticos via `useId()`.
 */
export interface FieldProps {
  label: string;
  helperText?: ReactNode;
  errorText?: ReactNode;
  required?: boolean;
  /** Função que recebe `id` e renderiza o input/textarea/select. */
  children: (props: { id: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, helperText, errorText, required, children, className }: FieldProps) {
  const id = useId();
  const hasError = Boolean(errorText);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-eyebrow text-n700">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children({ id, "aria-invalid": hasError || undefined })}
      {(hasError || helperText) && (
        <p
          className={cn(
            "text-body-s",
            hasError ? "text-danger" : "text-n500",
          )}
        >
          {errorText || helperText}
        </p>
      )}
    </div>
  );
}
