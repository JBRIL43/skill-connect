import { Skeleton } from "@/components/ui/skeleton";

export default function MatcherLoading() {
  return (
    <div className="min-h-svh">
      <div className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
