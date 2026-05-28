"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { IMAGE_MIMES, MB } from "@/lib/blob-constants";
import type { UploadKind } from "@/lib/schemas";

const ACCEPT = IMAGE_MIMES.join(",");

/** Limites alinhados com app/api/upload/route.ts — pré-check no client. */
const LIMITS: Record<UploadKind, number> = {
  logo: 4 * MB,
  hero: 8 * MB,
};

function formatMB(bytes: number): string {
  return `${(bytes / MB).toFixed(0)}MB`;
}

interface Props {
  kind: UploadKind;
  /** URL atual (vinda do tenant) ou pendente (recém uploaded). */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Texto auxiliar logo abaixo do botão de upload. */
  hint?: string;
  /** Aspect ratio do preview. Default 1:1 pra logo, 16:9 pra hero. */
  aspect?: "square" | "video";
}

export function ImageUpload({ kind, value, onChange, hint, aspect }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewAspect = aspect ?? (kind === "logo" ? "square" : "video");

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (!IMAGE_MIMES.includes(file.type as (typeof IMAGE_MIMES)[number])) {
      toast.error(`"${file.name}" não é uma imagem suportada (JPG, PNG ou WebP).`);
      return;
    }
    if (file.size > LIMITS[kind]) {
      toast.error(`"${file.name}" é maior que o limite (${formatMB(LIMITS[kind])}).`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload.");
      onChange(data.url);
      toast.success("Imagem atualizada.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const previewClass = cn(
    "relative overflow-hidden rounded-lg bg-n100 ring-1 ring-n200",
    previewAspect === "square" ? "aspect-square w-32" : "aspect-video w-full max-w-md",
  );

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-start gap-4">
          <div className={previewClass}>
            <Image
              src={value}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 240px"
              className={cn(
                previewAspect === "square" ? "object-contain p-2" : "object-cover",
              )}
              unoptimized
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={pickFile}
              disabled={uploading}
              leadingIcon={
                uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />
              }
            >
              {uploading ? "Enviando…" : "Trocar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={uploading}
              leadingIcon={<Trash2 className="h-4 w-4 text-danger" />}
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className={cn(
            "flex w-full max-w-md items-center justify-center gap-2",
            "rounded-lg border-2 border-dashed border-n200 bg-n50",
            "px-6 py-10 text-body-s font-medium text-n600 transition-colors",
            "hover:border-n400 hover:bg-white hover:text-ink",
            "disabled:cursor-wait disabled:opacity-60",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              Escolher imagem
            </>
          )}
        </button>
      )}
      {hint && <p className="text-body-s text-n500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
