import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { LegalEntity } from "@/app/_lib/types";

export type EntityRow = LegalEntity & { propertyCount: number };

export async function listEntities(): Promise<EntityRow[]> {
  const supabase = await createClient();
  const [{ data: ents }, { data: props }] = await Promise.all([
    supabase
      .from("legal_entities")
      .select("*")
      .is("deleted_at", null)
      .order("nombre"),
    supabase.from("properties").select("entity_id").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const p of props ?? []) {
    if (p.entity_id) counts.set(p.entity_id, (counts.get(p.entity_id) ?? 0) + 1);
  }
  return (ents ?? []).map((e) => ({
    ...(e as LegalEntity),
    propertyCount: counts.get((e as LegalEntity).id) ?? 0,
  }));
}

/** Solo id + nombre (para selects). */
export async function listEntityOptions(): Promise<{ id: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_entities")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre");
  return (data ?? []) as { id: string; nombre: string }[];
}
