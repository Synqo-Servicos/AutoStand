import { Skeleton } from "@/components/ui";

export default function TransacoesLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-7 w-32" />
          <Skeleton variant="text" className="h-4 w-48" />
        </div>
        <Skeleton variant="rect" className="h-9 w-28 rounded-lg" />
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden mb-6">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <Skeleton variant="text" className="h-4 w-32" />
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
              <Skeleton variant="text" className="h-3.5 w-16" />
              <Skeleton variant="text" className="h-3.5 w-20" />
              <Skeleton variant="text" className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div className="bg-white rounded-xl border border-n100 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-n100">
          <Skeleton variant="text" className="h-4 w-40" />
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton variant="rect" className="h-5 w-20 rounded-full" />
                  <Skeleton variant="text" className="h-3 w-14" />
                </div>
                <Skeleton variant="text" className="h-4 w-40" />
              </div>
              <Skeleton variant="text" className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
