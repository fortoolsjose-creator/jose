import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Property, Unit } from "@/app/_lib/types";

export type PropertyWithCounts = Property & {
  unit_count: number;
  occupied_count: number;
};

export async function listProperties(): Promise<PropertyWithCounts[]> {
  const supabase = await createClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const { data: units } = await supabase
    .from("units")
    .select("property_id, status")
    .is("deleted_at", null);

  const counts = new Map<string, { total: number; occ: number }>();
  for (const u of units ?? []) {
    const e = counts.get(u.property_id) ?? { total: 0, occ: 0 };
    e.total += 1;
    if (u.status === "occupied") e.occ += 1;
    counts.set(u.property_id, e);
  }

  return (props ?? []).map((p) => ({
    ...(p as Property),
    unit_count: counts.get(p.id)?.total ?? 0,
    occupied_count: counts.get(p.id)?.occ ?? 0,
  }));
}

/** Todas las unidades (plano) con el nombre de su edificio — para selects. */
export async function listUnitsFlat(): Promise<{ id: string; label: string; property: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, label, property:properties(name)")
    .is("deleted_at", null)
    .order("label", { ascending: true });
  return (data ?? []).map((u) => ({
    id: u.id as string,
    label: u.label as string,
    property: (u as unknown as { property?: { name: string } | null }).property?.name ?? "",
  }));
}

export async function getProperty(id: string): Promise<Property | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Property) ?? null;
}

export async function listUnits(propertyId: string): Promise<Unit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("*")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("label", { ascending: true });
  return (data ?? []) as Unit[];
}

export type UnitLease = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  deposit_paid: boolean;
  rent_amount: number;
  renewals: number;
};
export type UnitWithLease = Unit & { lease: UnitLease | null };

/** Units of a property, each with its ACTIVE lease (vigencia, depósito, # renovaciones). */
export async function listUnitsWithLease(propertyId: string): Promise<UnitWithLease[]> {
  const supabase = await createClient();
  const units = await listUnits(propertyId);
  if (units.length === 0) return [];

  const { data: leases } = await supabase
    .from("leases")
    .select("id, unit_id, start_date, end_date, deposit_paid, rent_amount")
    .in("unit_id", units.map((u) => u.id))
    .eq("status", "active")
    .is("deleted_at", null);

  const leaseByUnit = new Map<
    string,
    { id: string; start_date: string | null; end_date: string | null; deposit_paid: boolean; rent_amount: number }
  >();
  for (const l of leases ?? [])
    leaseByUnit.set(l.unit_id as string, l as never);

  const renewalsByLease = new Map<string, number>();
  const leaseIds = (leases ?? []).map((l) => l.id as string);
  if (leaseIds.length > 0) {
    const { data: rens } = await supabase
      .from("lease_renewals")
      .select("lease_id")
      .in("lease_id", leaseIds);
    for (const r of rens ?? [])
      renewalsByLease.set(r.lease_id as string, (renewalsByLease.get(r.lease_id as string) ?? 0) + 1);
  }

  return units.map((u) => {
    const l = leaseByUnit.get(u.id);
    return {
      ...u,
      lease: l
        ? {
            id: l.id,
            start_date: l.start_date,
            end_date: l.end_date,
            deposit_paid: !!l.deposit_paid,
            rent_amount: Number(l.rent_amount),
            renewals: renewalsByLease.get(l.id) ?? 0,
          }
        : null,
    };
  });
}
