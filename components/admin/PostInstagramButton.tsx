"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Share2, Lock, X, Download, Copy, Check, Loader2, RefreshCw } from "lucide-react";

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
      <button
        type="button"
        onClick={() => router.push("/admin/assinatura")}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-n200 rounded-lg text-n500 hover:bg-n50 transition-colors cursor-pointer"
      >
        <Lock className="w-4 h-4" />
        Post para Instagram
        <span className="text-xs font-semibold bg-signal/15 text-signal rounded px-1.5 py-0.5">Pro</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-signal text-ink rounded-lg hover:bg-signal-dark transition-colors cursor-pointer"
      >
        <Share2 className="w-4 h-4" />
        Post para Instagram
      </button>
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

  const imgUrl = `/api/veiculos/${vehicleId}/post?v=${imgVersion}`;

  const gerarLegenda = useCallback(async () => {
    setLoadingLegenda(true);
    setError(null);
    try {
      const res = await fetch(`/api/veiculos/${vehicleId}/legenda`, { method: "POST" });
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-n100">
          <h2 className="text-base font-semibold text-ink">Post para Instagram</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-n400 hover:bg-n100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!hasPhoto ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-n600 text-center">
              Adicione uma foto ao veículo para gerar o post.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Preview da imagem */}
            <div>
              <p className="text-xs font-medium text-n600 mb-2">Imagem (1080×1080)</p>
              <div className="relative rounded-xl overflow-hidden border border-n200 bg-n100 aspect-square">
                {!imgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-n400" />
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
                <button
                  type="button"
                  onClick={gerarLegenda}
                  disabled={loadingLegenda}
                  className="inline-flex items-center gap-1.5 text-xs text-n600 hover:text-ink disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loadingLegenda
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  Gerar outra
                </button>
              </div>
              <textarea
                rows={10}
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                disabled={loadingLegenda}
                placeholder={loadingLegenda ? "Gerando legenda..." : "A legenda aparecerá aqui."}
                className="w-full border border-n200 rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-transparent resize-none disabled:bg-n50"
              />
              {error && <p className="text-xs text-danger mt-1">{error}</p>}
              <button
                type="button"
                onClick={copiar}
                disabled={!legenda || loadingLegenda}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm border border-n200 rounded-lg text-n600 hover:bg-n50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiada!" : "Copiar legenda"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
