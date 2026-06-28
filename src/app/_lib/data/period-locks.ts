import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** ¿El periodo (YYYY-MM-01) está cerrado para esta org? */
export async function isPeriodLocked(
  supabase: SupabaseClient,
  orgId: string,
  period: string | null,
): Promise<boolean> {
  if (!period) return false;
  const { data } = await supabase
    .from("period_locks")
    .select("period_month")
    .eq("org_id", orgId)
    .eq("period_month", period)
    .maybeSingle();
  return !!data;
}

/** Lista de meses cerrados (más reciente primero). */
export async function listLockedPeriods(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("period_locks")
    .select("period_month")
    .order("period_month", { ascending: false });
  return (data ?? []).map((r) => r.period_month as string);
}
