import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the SERVICE-ROLE key. This BYPASSES Row-Level Security, so it
 * must only be used by trusted server-side jobs (seeding, inviting a tenant, etc.)
 * — NEVER for tenant-facing reads/writes. Lives behind `server-only`.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
