import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { LeaseStatus } from "@/app/_lib/types";

export type LeaseRow = {
  id: string;
  status: LeaseStatus;
  rent_amount: number;
  deposit_amount: number;
  payment_day: number;
  start_date: string | null;
  end_date: string | null;
  unit_id: string;
  tenant_profile_id: string | null;
  unit: { label: string; property: { name: string } | null } | null;
  tenant: { full_name: string | null; email: string | null; phone: string | null } | null;
};

export async function listLeases(): Promise<LeaseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leases")
    .select(
      "id, status, rent_amount, deposit_amount, payment_day, start_date, end_date, unit_id, tenant_profile_id, unit:units(label, property:properties(name)), tenant:profiles(full_name, email, phone)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LeaseRow[];
}

export type VacantUnit = {
  id: string;
  label: string;
  rent_amount: number;
  deposit_amount: number;
  property: { name: string } | null;
};

/**
 * Unidades a las que se les puede asignar un contrato: las que NO tienen un
 * contrato activo (estén marcadas "disponible" u "ocupada"). Así también
 * aparecen unidades ocupadas a las que les falta capturar su contrato.
 */
export async function listVacantUnits(): Promise<VacantUnit[]> {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("id, label, rent_amount, deposit_amount, property:properties(name)")
    .is("deleted_at", null)
    .order("label", { ascending: true });
  const { data: activeLeases } = await supabase
    .from("leases")
    .select("unit_id")
    .eq("status", "active")
    .is("deleted_at", null);
  const taken = new Set((activeLeases ?? []).map((l) => l.unit_id));
  return (units ?? []).filter((u) => !taken.has(u.id)) as unknown as VacantUnit[];
}
