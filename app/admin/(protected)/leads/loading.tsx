import { Skeleton } from "@/components/ui";

export default function LeadsLoading() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 space-y-2">
        <Skeleton variant="text" className="h-7 w-40" />
        <Skeleton variant="text" className="h-4 w-full max-w-md" />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-n100 p-4 space-y-2">
            <Skeleton variant="text" className="h-6 w-10" />
            <Skeleton variant="text" className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Kanban de estágios */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0">
            <div className="mb-3 flex items-center justify-between px-1">
              <Skeleton variant="rect" className="h-5 w-20 rounded-full" />
              <Skeleton variant="text" className="h-3 w-4" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-n100 p-4 space-y-2">
                  <Skeleton variant="text" className="h-4 w-3/4" />
                  <Skeleton variant="text" className="h-3 w-1/2" />
                  <Skeleton variant="text" className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: uma coluna */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-n100 p-4 space-y-2">
            <Skeleton variant="text" className="h-4 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
