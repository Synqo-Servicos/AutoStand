import { Skeleton } from "@/components/ui";

export default function DocumentosLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8 space-y-2">
        <Skeleton variant="text" className="h-7 w-64" />
        <Skeleton variant="text" className="h-4 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-n100 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Skeleton variant="rect" className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-4 w-3/4" />
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
