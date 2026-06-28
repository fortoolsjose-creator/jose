"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";

/** Sign the current user out and send them to the login page. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
