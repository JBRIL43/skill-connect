import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile, homePathForRole } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // In mock mode there is no Supabase project to sign in against.
  // /demo is the identity selector for offline/demo use.
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock") redirect("/demo");

  const profile = await getSessionProfile();
  if (profile) redirect(homePathForRole(profile.role));

  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Job seekers, companies, and admins all sign in here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
