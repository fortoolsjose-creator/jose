import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Prospect } from "@/app/_lib/types";

export type ProspectRow = Prospect & { propertyName: string | null; unitLabel: string | null };

export async function listProspects(): Promise<ProspectRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prospects")
    .select("*, property:properties(name), unit:units(label)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => {
    const row = p as unknown as Prospect & {
      property?: { name: string } | null;
      unit?: { label: string } | null;
    };
    return { ...row, propertyName: row.property?.name ?? null, unitLabel: row.unit?.label ?? null };
  });
}
