import { Skeleton } from "@/components/ui";
import { VehicleCardSkeleton } from "@/components/marketplace/VehicleCardSkeleton";

export default function ComprarLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5 py-6 sm:py-10">
      <header className="mb-6 sm:mb-8 space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-72" />
      </header>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — só renderiza em lg+ pra casar com a página real */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-n200 bg-white p-5 shadow-xs space-y-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton variant="text" className="h-3 w-20" />
                <Skeleton variant="rect" className="h-10 w-full rounded-md" />
              </div>
            ))}
            <Skeleton variant="rect" className="h-10 w-full rounded-md" />
          </div>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <Skeleton variant="text" className="h-3 w-32" />
            <Skeleton variant="rect" className="h-9 w-40 rounded-md" />
          </div>
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
