import { Skeleton } from "@/components/ui";

export default function VeiculosLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-7 w-36" />
          <Skeleton variant="text" className="h-4 w-24" />
        </div>
        <Skeleton variant="rect" className="h-10 w-32 rounded-md" />
      </div>

      {/* Desktop: tabela skeleton */}
      <div className="hidden md:block bg-white rounded-xl border border-n200 overflow-hidden shadow-xs">
        <div className="bg-n50 border-b border-n200 px-4 py-3 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center"
            >
              <div className="flex items-center gap-3">
                <Skeleton variant="rect" className="h-9 w-12 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton variant="text" className="h-4 w-32" />
                  <Skeleton variant="text" className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton variant="text" className="h-4 w-12" />
                <Skeleton variant="text" className="h-3 w-16" />
              </div>
              <Skeleton variant="text" className="h-4 w-20" />
              <Skeleton variant="text" className="h-4 w-20" />
              <Skeleton variant="text" className="h-4 w-16" />
              <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
              <Skeleton variant="rect" className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: cards skeleton */}
      <ul className="md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="flex gap-3 bg-white rounded-xl border border-n200 p-3"
          >
            <Skeleton variant="rect" className="h-20 w-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <Skeleton variant="text" className="h-4 w-3/4" />
                  <Skeleton variant="text" className="h-3 w-1/2" />
                </div>
                <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton variant="text" className="h-5 w-28" />
                <Skeleton variant="text" className="h-3 w-20" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
