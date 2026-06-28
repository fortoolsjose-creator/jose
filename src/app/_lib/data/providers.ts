import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Provider } from "@/app/_lib/types";

export type ProviderWithUsage = Provider & { usos: number };

/** Proveedores + cuántas veces aparecen como "vendor" en gastos (frecuencia de uso). */
export async function listProviders(): Promise<ProviderWithUsage[]> {
  const supabase = await createClient();
  const [{ data: provs }, { data: exps }] = await Promise.all([
    supabase.from("providers").select("*").is("deleted_at", null).order("name"),
    supabase.from("expenses").select("vendor").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const e of exps ?? []) {
    const v = (e.vendor as string | null)?.trim().toLowerCase();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return (provs ?? []).map((p) => ({
    ...(p as Provider),
    usos: counts.get((p.name as string).trim().toLowerCase()) ?? 0,
  }));
}
