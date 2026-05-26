import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Concatena class names com dedupe inteligente de utilitárias Tailwind.
 * `cn("p-2 p-4", isActive && "bg-signal")` → `"p-4 bg-signal"`.
 * Resolve conflitos do Tailwind (último ganha) e descarta valores falsy.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
