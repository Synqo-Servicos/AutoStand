import { Skeleton } from "@/components/ui";

export default function TenantsLoading() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-8 w-56" />
          <Skeleton variant="text" className="h-4 w-32" />
        </div>
        <Skeleton variant="rect" className="h-10 w-44 rounded-md" />
      </div>

      <div className="bg-white rounded-xl border border-n200 overflow-hidden shadow-xs">
        <div className="bg-n50 px-4 py-3 grid grid-cols-[2fr_1.5fr_0.7fr_0.7fr_1fr_auto] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-3 w-20" />
          ))}
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 grid grid-cols-[2fr_1.5fr_0.7fr_0.7fr_1fr_auto] gap-4 items-center"
            >
              <div className="flex items-center gap-3">
                <Skeleton variant="rect" className="h-9 w-9 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton variant="text" className="h-4 w-32" />
                  <Skeleton variant="text" className="h-3 w-16" />
                </div>
              </div>
              <Skeleton variant="text" className="h-4 w-40" />
              <Skeleton variant="text" className="h-4 w-10" />
              <Skeleton variant="text" className="h-4 w-10" />
              <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
              <Skeleton variant="rect" className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
