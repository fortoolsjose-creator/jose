import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

/** Procesos marcados como hechos en un periodo (set de números de proceso). */
export async function getCompletions(period: string): Promise<Set<number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("process_completions")
    .select("process_no, done")
    .eq("period_month", period);
  const done = new Set<number>();
  for (const r of data ?? []) if (r.done) done.add(r.process_no as number);
  return done;
}
