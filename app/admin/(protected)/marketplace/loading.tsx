import { Skeleton } from "@/components/ui";

export default function MarketplaceLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8 space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-full max-w-md" />
      </div>

      <div className="bg-white rounded-xl border border-n100 p-6 mb-6 space-y-4">
        <Skeleton variant="text" className="h-4 w-52" />
        <Skeleton variant="text" className="h-3 w-full max-w-sm" />
        <Skeleton variant="rect" className="h-9 w-40 rounded-md" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-n100 p-5 space-y-3">
            <Skeleton variant="rect" className="h-5 w-5 rounded" />
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="text" className="h-3 w-full" />
            <Skeleton variant="text" className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
