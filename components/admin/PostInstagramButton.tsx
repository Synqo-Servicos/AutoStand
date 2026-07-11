"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Share2, Lock, Download, Copy, Check, RefreshCw } from "lucide-react";
import { Button, Drawer, Textarea } from "@/components/ui";

interface Props {
  vehicleId: number;
  /** Plano do tenant libera o recurso (instagramPost). */
  canUse: boolean;
  /** Veículo tem foto principal — sem ela não há post. */
  hasPhoto: boolean;
}

/**
 * Botão + slideover de geração do post de Instagram de um veículo.
 * Recurso do plano Pro — quando bloqueado, leva para a página de assinatura.
 */
export function PostInstagramButton({ vehicleId, canUse, hasPhoto }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!canUse) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/admin/assinatura")}
        leadingIcon={<Lock className="w-4 h-4" />}
      >
        Post para Instagram
        <span className="text-xs font-semibold bg-signal/15 text-signal rounded px-1.5 py-0.5">Pro</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        leadingIcon={<Share2 className="w-4 h-4" />}
      >
        Post para Instagram
      </Button>
      {open && <PostSlideOver vehicleId={vehicleId} hasPhoto={hasPhoto} onClose={() => setOpen(false)} />}
    </>
  );
}

function PostSlideOver({
  vehicleId,
  hasPhoto,
  onClose,
}: {
  vehicleId: number;
  hasPhoto: boolean;
  onClose: () => void;
}) {
  const [imgVersion] = useState(() => Date.now());
  const [imgLoaded, setImgLoaded] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [loadingLegenda, setLoadingLegenda] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const imgUrl = `/api/vehicles/${vehicleId}/social/post?v=${imgVersion}`;

  const gerarLegenda = useCallback(async () => {
    setLoadingLegenda(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/social/caption`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar a legenda");
      setLegenda(data.legenda);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingLegenda(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (hasPhoto) gerarLegenda();
  }, [hasPhoto, gerarLegenda]);

  async function copiar() {
    await navigator.clipboard.writeText(legenda);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Drawer
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      side="right"
      title="Post para Instagram"
      className="max-w-lg"
    >
      {!hasPhoto ? (
        <div className="flex h-full items-center justify-center text-center">
          <p className="text-sm text-n600">
            Adicione uma foto ao veículo para gerar o post.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview da imagem */}
          <div>
            <p className="text-xs font-medium text-n600 mb-2">Imagem (1080×1080)</p>
            <div className="relative rounded-xl overflow-hidden border border-n200 bg-n100 aspect-square">
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-n400" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt="Pré-visualização do post"
                className="w-full h-full object-cover"
                onLoad={() => setImgLoaded(true)}
              />
            </div>
            <a
              href={imgUrl}
              download={`post-veiculo-${vehicleId}.png`}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar imagem
            </a>
          </div>

          {/* Legenda */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-n600">Legenda</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={gerarLegenda}
                loading={loadingLegenda}
                leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Gerar outra
              </Button>
            </div>
            <Textarea
              rows={10}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              disabled={loadingLegenda}
              placeholder={loadingLegenda ? "Gerando legenda..." : "A legenda aparecerá aqui."}
              className="resize-none"
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copiar}
              disabled={!legenda || loadingLegenda}
              leadingIcon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              className="mt-2"
            >
              {copied ? "Copiada!" : "Copiar legenda"}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
