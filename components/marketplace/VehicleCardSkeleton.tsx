import { Skeleton } from "@/components/ui";

/** Skeleton com a mesma forma do MarketplaceVehicleCard — usar em loading state. */
export function VehicleCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-n200 bg-white shadow-xs">
      {/* Foto 4:3 */}
      <Skeleton variant="rect" className="aspect-[4/3] w-full rounded-none" />

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <Skeleton variant="text" className="h-3 w-16" />
          <Skeleton variant="text" className="h-5 w-3/4" />
          <Skeleton variant="text" className="h-3 w-1/2" />
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          <Skeleton variant="rect" className="h-5 w-14 rounded-full" />
          <Skeleton variant="rect" className="h-5 w-20 rounded-full" />
          <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
          <Skeleton variant="rect" className="h-5 w-20 rounded-full" />
        </div>

        {/* Preço + loja */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3 border-t border-n100">
          <div className="space-y-1.5">
            <Skeleton variant="text" className="h-3 w-12" />
            <Skeleton variant="text" className="h-6 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="rect" className="h-8 w-8 rounded-md" />
            <div className="space-y-1">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-3 w-12" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
