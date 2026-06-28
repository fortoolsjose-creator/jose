import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";

/**
 * Data Access Layer. Verify the session HERE (at data-fetch time), not in a layout —
 * layouts don't re-render on navigation in Next 16. `cache()` memoizes within a single
 * request so repeated calls don't re-hit Supabase.
 *
 * RLS is the real boundary; these helpers are convenience + UX redirects.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const verifySession = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

export type Profile = {
  id: string;
  org_id: string;
  role: "owner" | "staff" | "tenant";
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

/** Current user's profile (org + role). Redirects to /login if unauthenticated. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await verifySession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, org_id, role, full_name, phone, email")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
});

/** True when the current user is an owner or staff member (admin side). */
export const isStaff = cache(async () => {
  const profile = await getProfile();
  return profile?.role === "owner" || profile?.role === "staff";
});
