"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Star, Trash2, Upload } from "lucide-react";
import { Button, Modal, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  IMAGE_MIMES, MAX_PHOTOS_PER_VEHICLE, PHOTO_MAX_BYTES,
} from "@/lib/blob-constants";

interface UploadedPhoto {
  url: string;
  isPrimary: boolean;
}

interface Props {
  vehicleId: number;
  initialPhotos?: { url: string; isPrimary: boolean }[];
  onChange?: (primaryUrl: string | null) => void;
}

const ACCEPT = IMAGE_MIMES.join(",");

/** Bytes humanizados pra mensagens de erro: 8388608 → "8MB". */
function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
}

export function PhotoUploader({ vehicleId, initialPhotos = [], onChange }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UploadedPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Pre-flight no client: bloqueia o upload antes de bater o servidor
   * em caso de tipo errado, arquivo grande demais ou estouro de cota.
   * Mais responsivo que esperar 8MB de upload pra cair em 413.
   */
  function validateBeforeUpload(files: File[]): string | null {
    if (photos.length + files.length > MAX_PHOTOS_PER_VEHICLE) {
      return (
        `Limite de ${MAX_PHOTOS_PER_VEHICLE} fotos por veículo. ` +
        `Você tem ${photos.length}, tentou adicionar ${files.length}.`
      );
    }
    for (const f of files) {
      if (!IMAGE_MIMES.includes(f.type as (typeof IMAGE_MIMES)[number])) {
        return `"${f.name}" não é uma imagem suportada (JPG, PNG ou WebP).`;
      }
      if (f.size > PHOTO_MAX_BYTES) {
        return `"${f.name}" é maior que o limite (${formatMB(PHOTO_MAX_BYTES)}).`;
      }
    }
    return null;
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const err = validateBeforeUpload(files);
    if (err) {
      toast.error(err);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      if (photos.length === 0) formData.append("set_primary", "true");

      const res = await fetch(`/api/vehicles/${vehicleId}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao fazer upload das fotos.");
      }

      const newPhotos: UploadedPhoto[] = (data.urls as string[]).map((url, i) => ({
        url,
        isPrimary: photos.length === 0 && i === 0,
      }));
      const updated = [...photos, ...newPhotos];
      setPhotos(updated);
      onChange?.(updated.find((p) => p.isPrimary)?.url ?? null);
      toast.success(
        files.length === 1 ? "Foto adicionada." : `${files.length} fotos adicionadas.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      // Limpa o input pra permitir reselecionar o mesmo arquivo
      // (caso o usuário tenha cancelado e queira tentar de novo).
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function performDelete(photo: UploadedPhoto) {
    setDeletingUrl(photo.url);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: photo.url, set_primary: photo.isPrimary }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erro ao excluir a foto.");
      }
      const updated = photos.filter((p) => p.url !== photo.url);
      // Se a foto excluída era a principal, promove a próxima.
      if (photo.isPrimary && updated.length > 0) updated[0].isPrimary = true;
      setPhotos(updated);
      onChange?.(updated.find((p) => p.isPrimary)?.url ?? null);
      toast.success("Foto excluída.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingUrl(null);
      setConfirmDelete(null);
    }
  }

  async function setPrimary(photo: UploadedPhoto) {
    if (photo.isPrimary) return;
    // Otimista: atualiza local antes da rede; servidor é authority via
    // updateVehicle (chamado no fim).
    const updated = photos.map((p) => ({ ...p, isPrimary: p.url === photo.url }));
    setPhotos(updated);
    onChange?.(photo.url);
    toast.success("Foto principal atualizada.");
  }

  const remaining = MAX_PHOTOS_PER_VEHICLE - photos.length;
  const canUpload = remaining > 0 && !uploading;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onClick={() => canUpload && inputRef.current?.click()}
        onDragOver={(e) => {
          if (!canUpload) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!canUpload) return;
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
          canUpload
            ? "border-n300 hover:border-signal hover:bg-signal/[0.04] cursor-pointer"
            : "border-n200 bg-n50 cursor-not-allowed opacity-70",
        )}
        role="button"
        aria-disabled={!canUpload}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-signal mx-auto mb-2" aria-hidden />
        ) : (
          <Upload className="w-6 h-6 text-n500 mx-auto mb-2" aria-hidden />
        )}
        <p className="text-body-s text-n700 font-medium">
          {uploading
            ? "Enviando..."
            : remaining > 0
            ? "Arraste fotos ou clique para selecionar"
            : "Limite de fotos atingido"}
        </p>
        <p className="text-body-s text-n500 mt-1">
          JPG, PNG ou WebP · até {formatMB(PHOTO_MAX_BYTES)} cada ·{" "}
          {photos.length}/{MAX_PHOTOS_PER_VEHICLE} fotos
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <li
              key={photo.url}
              className="relative aspect-[4/3] rounded-lg overflow-hidden bg-n100 ring-1 ring-n200"
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />

              {photo.isPrimary && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-white" />
                  Principal
                </span>
              )}

              {/* Toolbar sempre visível — funciona em touch sem precisar
                  do hover overlay. Buttons individuais com bg branco
                  + sombra leve dão peso visual mesmo sobre foto clara. */}
              <div className="absolute right-2 top-2 flex gap-1.5">
                {!photo.isPrimary && (
                  <PhotoAction
                    icon={Star}
                    label="Definir como principal"
                    onClick={() => setPrimary(photo)}
                  />
                )}
                <PhotoAction
                  icon={Trash2}
                  label="Excluir foto"
                  tone="danger"
                  loading={deletingUrl === photo.url}
                  onClick={() => setConfirmDelete(photo)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Estado vazio (sem foto cadastrada) */}
      {photos.length === 0 && !uploading && (
        <div className="rounded-xl border border-dashed border-n200 px-6 py-12 text-center text-n500">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 text-n400" aria-hidden />
          <p className="text-body-s">Nenhuma foto ainda. A primeira que você subir vira a foto principal.</p>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      <Modal
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        size="sm"
        title="Excluir esta foto?"
        description="A ação é permanente — a foto não será recuperada."
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(null)}
              disabled={deletingUrl !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={deletingUrl !== null}
              onClick={() => confirmDelete && performDelete(confirmDelete)}
            >
              Excluir foto
            </Button>
          </>
        }
      >
        {confirmDelete?.isPrimary && (
          <p className="text-body-s text-n700">
            Esta é a foto <strong>principal</strong>. A próxima da lista será promovida
            automaticamente.
          </p>
        )}
      </Modal>
    </div>
  );
}

/**
 * Botão de ação dentro do card da foto. Sempre visível (sem hover) pra
 * funcionar em touch. tone="danger" vermelhinho pra exclusão.
 */
function PhotoAction({
  icon: Icon,
  label,
  onClick,
  loading,
  tone = "neutral",
}: {
  icon: typeof Star;
  label: string;
  onClick: () => void;
  loading?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "bg-white/95 backdrop-blur-sm shadow-sm ring-1 ring-ink/5",
        "transition-[transform,background-color,color] duration-150",
        "hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed",
        tone === "danger"
          ? "text-danger hover:bg-danger hover:text-white"
          : "text-ink hover:bg-ink hover:text-white",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
