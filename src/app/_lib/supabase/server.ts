import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Carries the signed-in user's session via cookies, so every query runs under
 * that user's Row-Level Security context. Never import this in a Client Component.
 *
 * Next 16: `cookies()` is async. The `getAll`/`setAll` cookie interface is the
 * current @supabase/ssr contract (the old get/set/remove triple is deprecated).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component render, where cookies
            // are read-only. Safe to ignore — proxy.ts refreshes the session
            // cookie on navigation.
          }
        },
      },
    },
  );
}
