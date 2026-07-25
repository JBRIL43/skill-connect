import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

import { PromoteForm } from "./promote-form";

export default async function PromotePage() {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Become an admin</CardTitle>
          <CardDescription>
            Signed in as {profile.full_name ?? "this account"}. Entering the
            team invite code promotes it to the admin console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoteForm />
        </CardContent>
      </Card>
    </div>
  );
}
