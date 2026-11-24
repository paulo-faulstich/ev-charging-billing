"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  FIXTURE_SIGNED_OUT_COOKIE,
  isFixtureAuth,
} from "@/lib/auth/mode";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password to continue." };
  }

  if (isFixtureAuth()) {
    const cookieStore = await cookies();
    cookieStore.delete(FIXTURE_SIGNED_OUT_COOKIE);
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: "Could not sign in. Check your details and try again.",
    };
  }

  redirect("/dashboard");
}
