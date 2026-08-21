import { Skeleton } from "@/components/ui/skeleton";

export default function SandboxLoading() {
  return (
    <div className="min-h-svh">
      <div className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        {/* Node tree skeleton */}
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </main>
    </div>
  );
}
