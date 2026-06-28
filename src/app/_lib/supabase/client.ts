import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (browser). Uses the public anon key only.
 * The service-role secret is never available here — unprefixed env vars are
 * stripped to empty strings on the client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
