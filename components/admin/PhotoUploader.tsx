"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  GripVertical, ImageIcon, Loader2, Star, Trash2, Upload,
} from "lucide-react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, rectSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
}

export function PhotoUploader({ vehicleId, initialPhotos = [], onChange }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UploadedPhoto | null>(null);
  const [draggingUrl, setDraggingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sensores: pointer (mouse + dedo) + touch (telas pequenas) + keyboard
  // (acessibilidade — setas movem o item ativo).
  // `distance: 8` evita que cliques curtos nos botões de ação virem drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      if (!res.ok) throw new Error(data?.error ?? "Erro ao fazer upload das fotos.");
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

  function setPrimary(photo: UploadedPhoto) {
    if (photo.isPrimary) return;
    const updated = photos.map((p) => ({ ...p, isPrimary: p.url === photo.url }));
    setPhotos(updated);
    onChange?.(photo.url);
    toast.success("Foto principal atualizada.");
  }

  /** Persiste a ordem atual no servidor; em caso de erro, reverte. */
  async function persistOrder(snapshot: UploadedPhoto[], next: UploadedPhoto[]) {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((p) => p.url) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erro ao salvar a ordem.");
      }
    } catch (e) {
      // Rollback: volta pra ordem anterior.
      setPhotos(snapshot);
      toast.error((e as Error).message);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingUrl(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingUrl(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.url === active.id);
    const newIndex = photos.findIndex((p) => p.url === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const snapshot = photos;
    const next = arrayMove(photos, oldIndex, newIndex);
    setPhotos(next);
    persistOrder(snapshot, next);
  }

  const remaining = MAX_PHOTOS_PER_VEHICLE - photos.length;
  const canUpload = remaining > 0 && !uploading;
  const draggingPhoto = draggingUrl
    ? photos.find((p) => p.url === draggingUrl) ?? null
    : null;

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

      {/* Grid de fotos com drag-and-drop */}
      {photos.length > 0 && (
        <>
          <p className="text-body-s text-n600">
            <GripVertical className="inline h-3.5 w-3.5 align-text-bottom text-n500" />
            {" "}Arraste para reordenar — a primeira é a foto principal no marketplace.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={photos.map((p) => p.url)}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <SortablePhotoCard
                    key={photo.url}
                    photo={photo}
                    deleting={deletingUrl === photo.url}
                    onSetPrimary={() => setPrimary(photo)}
                    onAskDelete={() => setConfirmDelete(photo)}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {draggingPhoto && (
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg shadow-xl ring-2 ring-signal/40">
                  <Image
                    src={draggingPhoto.url}
                    alt=""
                    width={400}
                    height={300}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* Estado vazio */}
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

interface SortableCardProps {
  photo: UploadedPhoto;
  deleting: boolean;
  onSetPrimary: () => void;
  onAskDelete: () => void;
}

function SortablePhotoCard({ photo, deleting, onSetPrimary, onAskDelete }: SortableCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: photo.url });

  // Esconde o original durante o drag — DragOverlay desenha a versão
  // flutuante com sombra/ring. Mantém o slot pra grid não pular.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative aspect-[4/3] rounded-lg overflow-hidden bg-n100 ring-1 ring-n200 touch-none"
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

      {/* Drag handle no canto inf. esquerdo — visual de "agarra aqui";
          a área inteira ainda é sensível, mas a alça é o sinal claro. */}
      <button
        type="button"
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="absolute left-2 bottom-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/95 backdrop-blur-sm shadow-sm ring-1 ring-ink/5 text-ink/70 hover:text-ink cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Ações sempre visíveis no canto sup. direito */}
      <div className="absolute right-2 top-2 flex gap-1.5">
        {!photo.isPrimary && (
          <PhotoAction icon={Star} label="Definir como principal" onClick={onSetPrimary} />
        )}
        <PhotoAction
          icon={Trash2}
          label="Excluir foto"
          tone="danger"
          loading={deleting}
          onClick={onAskDelete}
        />
      </div>
    </li>
  );
}

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
      onPointerDown={(e) => e.stopPropagation()}
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

// Mantém efeito de "primary segue a primeira posição" quando reordena —
// hook isolado pra não poluir o componente principal e pra rodar uma
// vez quando o primeiro item muda.
function useSyncPrimaryWithFirst(
  photos: UploadedPhoto[],
  setPhotos: (next: UploadedPhoto[]) => void,
) {
  const firstUrl = photos[0]?.url;
  useEffect(() => {
    if (!firstUrl) return;
    if (photos[0]?.isPrimary) return;
    setPhotos(photos.map((p, i) => ({ ...p, isPrimary: i === 0 })));
  }, [firstUrl, photos, setPhotos]);
}

// Helper exportado pra ser explícito sobre o comportamento, mas não
// estamos usando-o ainda — a regra atual é: "primária" é independente
// da ordem. Se quiser ativar, basta chamar useSyncPrimaryWithFirst()
// dentro do PhotoUploader.
export { useSyncPrimaryWithFirst };
