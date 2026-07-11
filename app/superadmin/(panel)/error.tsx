"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-n100 text-n500 mb-5">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-display text-h2 font-semibold text-ink">
          Algo deu errado
        </h1>
        <p className="mt-2 text-body-s text-n600">
          Não conseguimos carregar este painel. Tente novamente — se o
          problema continuar, verifique os logs ou tente mais tarde.
        </p>
        <Button className="mt-6" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
