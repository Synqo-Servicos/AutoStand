import { Skeleton } from "@/components/ui";

export default function ParceirosLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-7 w-32" />
          <Skeleton variant="text" className="h-4 w-28" />
        </div>
        <Skeleton variant="rect" className="h-9 w-40 rounded-lg" />
      </div>

      <div className="bg-white rounded-xl border border-n200/70 overflow-hidden">
        <div className="bg-n50 border-b border-n100 px-4 py-3 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-n100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center">
              <div className="space-y-1.5">
                <Skeleton variant="text" className="h-4 w-28" />
                <Skeleton variant="text" className="h-3 w-20" />
              </div>
              <Skeleton variant="text" className="h-3.5 w-16" />
              <Skeleton variant="text" className="h-3.5 w-12" />
              <Skeleton variant="text" className="h-3.5 w-20" />
              <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
              <Skeleton variant="rect" className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
