import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Listing } from "@/app/_lib/types";

export type ListingRow = Listing & {
  unit: { label: string; property: { name: string } | null } | null;
  application_count: number;
};

export async function listListings(): Promise<ListingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, unit:units(label, property:properties(name))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: apps } = await supabase
    .from("applications")
    .select("listing_id")
    .is("deleted_at", null);
  const counts = new Map<string, number>();
  for (const a of apps ?? [])
    counts.set(a.listing_id, (counts.get(a.listing_id) ?? 0) + 1);

  return (data ?? []).map((l) => ({
    ...(l as Listing),
    unit: (l as unknown as { unit: ListingRow["unit"] }).unit,
    application_count: counts.get(l.id) ?? 0,
  })) as unknown as ListingRow[];
}

export type ListableUnit = {
  id: string;
  label: string;
  rent_amount: number;
  property: { name: string } | null;
};

/** Vacant units that don't already have an open listing. */
export async function listUnitsForListing(): Promise<ListableUnit[]> {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("id, label, rent_amount, property:properties(name)")
    .eq("status", "vacant")
    .is("deleted_at", null)
    .order("label");
  const { data: listings } = await supabase
    .from("listings")
    .select("unit_id")
    .is("deleted_at", null)
    .neq("status", "filled");
  const taken = new Set((listings ?? []).map((l) => l.unit_id));
  return ((units ?? []) as unknown as ListableUnit[]).filter(
    (u) => !taken.has(u.id),
  );
}
