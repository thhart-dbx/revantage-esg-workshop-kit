import { Skeleton } from "@/components/ui/skeleton";

export function SurveySkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading survey">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-10 w-3/4" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-8 h-56 w-full rounded-xl" />
    </div>
  );
}
