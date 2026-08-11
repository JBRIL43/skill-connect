import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Minimal skeleton shown while the page awaits requireProfile().
// No profile yet, so we render the header placeholder manually.
export default function CoachLoading() {
  return (
    <div className="min-h-svh bg-muted/30">
      <div className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader className="gap-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
