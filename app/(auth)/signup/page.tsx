import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile, homePathForRole } from "@/lib/auth";

export default async function SignupPage() {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock") redirect("/demo");

  const profile = await getSessionProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Free for job seekers. Companies start with a free AI Readiness
          Snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
