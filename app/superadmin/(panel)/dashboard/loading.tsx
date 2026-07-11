import { Skeleton } from "@/components/ui";

export default function SuperAdminDashboardLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      {/* Hero */}
      <section className="rounded-2xl bg-ink px-7 py-8 mb-8 max-w-lg space-y-3">
        <Skeleton variant="text" className="h-3 w-32 bg-white/15" />
        <Skeleton variant="text" className="h-8 w-48 bg-white/20" />
        <Skeleton variant="text" className="h-3.5 w-full bg-white/10" />
        <Skeleton variant="rect" className="h-10 w-44 rounded-md bg-white/15" />
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-n200 p-5 space-y-3">
            <Skeleton variant="rect" className="h-9 w-9 rounded-lg" />
            <Skeleton variant="text" className="h-6 w-10" />
            <Skeleton variant="text" className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Recent tenants */}
      <section className="bg-white rounded-xl border border-n200 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-n100">
          <Skeleton variant="text" className="h-4 w-44" />
          <Skeleton variant="text" className="h-3.5 w-16" />
        </header>
        <div className="divide-y divide-n100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3.5">
              <Skeleton variant="rect" className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton variant="text" className="h-3.5 w-40" />
                <Skeleton variant="text" className="h-3 w-28" />
              </div>
              <Skeleton variant="text" className="h-3 w-16 hidden sm:block" />
              <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
