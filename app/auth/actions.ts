"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export type AuthState = {
  error?: string;
  notice?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const fullName = readString(formData, "full_name");
  const companyName = readString(formData, "company_name");
  const roleInput = readString(formData, "role");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Only these two are self-serve. Admin is granted out of band (Section 4),
  // and the signup trigger rejects it too, so this is defence in depth.
  const role: UserRole = roleInput === "sme" ? "sme" : "job_seeker";

  if (role === "sme" && !companyName) {
    return { error: "Company name is required for an SME account." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName,
        company_name: companyName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Supabase returns a user but no session when email confirmation is on. For
  // the hackathon, confirmation is turned off in the Supabase dashboard so the
  // demo never waits on an inbox — this branch is the safety net if it is not.
  if (!data.session) {
    return {
      notice: "Account created. Check your email to confirm, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect(homePathForRole(role));
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const next = readString(formData, "next");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  revalidatePath("/", "layout");

  // An explicit ?next= wins, except for admins, who always land on the console.
  const role = (profile?.role as UserRole | undefined) ?? "job_seeker";
  redirect(next && role !== "admin" ? next : homePathForRole(role));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
