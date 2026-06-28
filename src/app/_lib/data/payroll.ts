import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Worker } from "@/app/_lib/types";

export async function listWorkers(): Promise<Worker[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workers")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as Worker[];
}
