import { Skeleton } from "@/components/ui";

export default function FinanceiroLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl space-y-5 sm:space-y-6">
      <header className="space-y-3 sm:flex sm:items-end sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-7 w-32" />
          <Skeleton variant="text" className="h-4 w-64" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton variant="rect" className="h-9 w-32 rounded-lg" />
          <Skeleton variant="rect" className="h-9 w-40 rounded-lg" />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-n100 pb-2">
        <Skeleton variant="text" className="h-4 w-16" />
        <Skeleton variant="text" className="h-4 w-24" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-n100 rounded-xl p-4 flex items-center gap-3">
            <Skeleton variant="rect" className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Composição do resultado */}
      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="px-5 py-4 border-b border-n100 space-y-1.5">
          <Skeleton variant="text" className="h-4 w-44" />
          <Skeleton variant="text" className="h-3 w-24" />
        </header>
        <div className="divide-y divide-n100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
              <Skeleton variant="text" className="h-3.5 w-48" />
              <Skeleton variant="text" className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
