import { Skeleton } from "@/components/ui";

export default function VendedoresLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <header className="mb-6 space-y-2">
        <Skeleton variant="text" className="h-7 w-32" />
        <Skeleton variant="text" className="h-4 w-full max-w-md" />
      </header>

      <section className="bg-white border border-n100 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-n100">
          <Skeleton variant="text" className="h-4 w-28" />
          <Skeleton variant="rect" className="h-8 w-28 rounded-lg" />
        </header>
        <div className="divide-y divide-n100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
              <Skeleton variant="text" className="h-3.5 w-32" />
              <Skeleton variant="text" className="h-3.5 w-24 hidden sm:block" />
              <Skeleton variant="text" className="h-3.5 w-16" />
              <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
              <div className="flex gap-2">
                <Skeleton variant="rect" className="h-7 w-7 rounded" />
                <Skeleton variant="rect" className="h-7 w-7 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
