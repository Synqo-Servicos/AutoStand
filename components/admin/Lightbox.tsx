"use client";

import { useEffect } from "react";
import * as RD from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  photos: { url: string }[];
  /** Índice da foto ativa, ou null quando fechado. */
  index: number | null;
  onClose: () => void;
  onChange: (next: number) => void;
}

/**
 * Visualizador fullscreen pras fotos do veículo. Não usa o Modal padrão
 * (que tem max-width) — aqui ocupa a viewport inteira pra a foto respirar.
 * Setas do teclado/swipe via prev/next, Esc fecha (Radix cuida disso).
 */
export function Lightbox({ photos, index, onClose, onChange }: Props) {
  const open = index !== null;
  const total = photos.length;
  const photo = open ? photos[index] : null;

  // Navegação por teclado — Radix já cuida do Escape, mas precisamos
  // mapear setas pra prev/next.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange((index! - 1 + total) % total);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onChange((index! + 1) % total);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, total, onChange]);

  if (!photo) return null;
  const canNav = total > 1;

  return (
    <RD.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-ink-900/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <RD.Content
          className={cn(
            "fixed inset-0 z-[var(--z-modal)] flex items-center justify-center",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
          aria-describedby={undefined}
        >
          <RD.Title className="sr-only">Foto {index! + 1} de {total}</RD.Title>

          {/* Foto centralizada — usa <img> pra preservar aspect natural sem
              cálculos de container; perde otimização de Next/Image mas a
              viewport admin é controlada. */}
          <img
            src={photo.url}
            alt=""
            className="max-h-[88vh] max-w-[88vw] object-contain shadow-2xl"
          />

          {/* Fechar */}
          <RD.Close
            className={cn(
              "absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center",
              "rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors",
              "hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            )}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </RD.Close>

          {/* Prev / Next — só aparecem com 2+ fotos */}
          {canNav && (
            <>
              <button
                type="button"
                onClick={() => onChange((index! - 1 + total) % total)}
                aria-label="Foto anterior"
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center",
                  "rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors",
                  "hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                )}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => onChange((index! + 1) % total)}
                aria-label="Próxima foto"
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center",
                  "rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors",
                  "hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                )}
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Contador */}
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-body-s text-white backdrop-blur-sm">
                {index! + 1} / {total}
              </p>
            </>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
