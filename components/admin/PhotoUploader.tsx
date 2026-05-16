"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, Star, Trash2, Loader2 } from "lucide-react";

interface UploadedPhoto {
  url: string;
  isPrimary: boolean;
}

interface Props {
  vehicleId: number;
  initialPhotos?: { url: string; isPrimary: boolean }[];
  onChange?: (primaryUrl: string | null) => void;
}

export function PhotoUploader({ vehicleId, initialPhotos = [], onChange }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      if (photos.length === 0) formData.append("set_primary", "true");

      const res = await fetch(`/api/vehicles/${vehicleId}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao fazer upload");

      const newPhotos: UploadedPhoto[] = data.urls.map((url: string, i: number) => ({
        url,
        isPrimary: photos.length === 0 && i === 0,
      }));
      const updated = [...photos, ...newPhotos];
      setPhotos(updated);
      onChange?.(updated.find(p => p.isPrimary)?.url ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(url: string) {
    const photo = photos.find(p => p.url === url);
    const res = await fetch(`/api/vehicles/${vehicleId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, set_primary: photo?.isPrimary }),
    });
    if (!res.ok) return;
    const updated = photos.filter(p => p.url !== url);
    if (photo?.isPrimary && updated.length > 0) updated[0].isPrimary = true;
    setPhotos(updated);
    onChange?.(updated.find(p => p.isPrimary)?.url ?? null);
  }

  function setPrimary(url: string) {
    const updated = photos.map(p => ({ ...p, isPrimary: p.url === url }));
    setPhotos(updated);
    onChange?.(url);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed border-n200 rounded-xl p-8 text-center cursor-pointer hover:border-signal hover:bg-signal/10 transition-colors"
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-signal mx-auto mb-2" />
        ) : (
          <Upload className="w-6 h-6 text-n400 mx-auto mb-2" />
        )}
        <p className="text-sm text-n600">
          {uploading ? "Enviando..." : "Arraste fotos ou clique para selecionar"}
        </p>
        <p className="text-xs text-n400 mt-1">JPG, PNG, WebP — múltiplos arquivos</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2">{error}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.url} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-n100">
              <Image src={photo.url} alt="" fill className="object-cover" />
              {photo.isPrimary && (
                <span className="absolute top-1.5 left-1.5 bg-warning text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-white" /> Principal
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!photo.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(photo.url)}
                    title="Definir como principal"
                    className="w-8 h-8 bg-warning rounded-lg flex items-center justify-center text-white hover:bg-warning transition-colors"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(photo.url)}
                  title="Excluir foto"
                  className="w-8 h-8 bg-danger rounded-lg flex items-center justify-center text-white hover:bg-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
