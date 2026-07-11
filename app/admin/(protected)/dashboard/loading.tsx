import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-6 sm:mb-8 space-y-2">
        <Skeleton variant="text" className="h-7 w-40" />
        <Skeleton variant="text" className="h-4 w-56" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-n100 p-4 space-y-2">
            <Skeleton variant="text" className="h-3 w-24" />
            <Skeleton variant="text" className="h-6 w-20" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Estoque — stacked bar */}
      <div className="mb-6 sm:mb-8 bg-white rounded-xl border border-n100 p-4 space-y-3">
        <Skeleton variant="text" className="h-3 w-20" />
        <Skeleton variant="rect" className="h-3 w-full rounded-full" />
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <Skeleton variant="text" className="h-4 w-32" />
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
              <Skeleton variant="text" className="h-3.5 w-16" />
              <Skeleton variant="text" className="h-3.5 w-20" />
              <Skeleton variant="text" className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
