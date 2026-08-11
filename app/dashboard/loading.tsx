import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <div className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-1">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
