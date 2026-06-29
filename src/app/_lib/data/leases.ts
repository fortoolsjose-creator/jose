import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { isOverdue, daysOverdue } from "@/app/_lib/data/finance";
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

export type LeaseRowFull = LeaseRow & {
  maintenance_fee: number;
  poliza_vigencia: string | null;
  ingreso: number; // renta + cuota
  saldoVencido: number;
  diasAtraso: number;
  puntualidad: number; // 0-1 (1 si aún no hay historial)
  pctIngreso: number; // participación en el ingreso de los activos
};

/** Arrendatarios con métricas para ordenar (saldo, atraso, puntualidad, ingreso, %). */
export async function listLeasesWithMetrics(): Promise<LeaseRowFull[]> {
  const supabase = await createClient();
  const [{ data: leases }, { data: pays }] = await Promise.all([
    supabase
      .from("leases")
      .select(
        "id, status, rent_amount, maintenance_fee, poliza_vigencia, deposit_amount, payment_day, start_date, end_date, unit_id, tenant_profile_id, unit:units(label, property:properties(name)), tenant:profiles(full_name, email, phone)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("lease_id, amount_due, amount_paid, status, due_date, paid_date, period_month")
      .is("deleted_at", null),
  ]);

  const agg = new Map<string, { saldo: number; oldest: string | null; aTiempo: number; concl: number }>();
  for (const p of pays ?? []) {
    const e = agg.get(p.lease_id as string) ?? { saldo: 0, oldest: null, aTiempo: 0, concl: 0 };
    if (isOverdue(p)) {
      e.saldo += Number(p.amount_due) - Number(p.amount_paid);
      if (p.due_date && (!e.oldest || (p.due_date as string) < e.oldest)) e.oldest = p.due_date as string;
    }
    if (p.paid_date) {
      e.concl += 1;
      if (p.due_date && (p.paid_date as string) <= (p.due_date as string)) e.aTiempo += 1;
    }
    agg.set(p.lease_id as string, e);
  }

  const rows: LeaseRowFull[] = (leases ?? []).map((l) => {
    const a = agg.get(l.id as string) ?? { saldo: 0, oldest: null, aTiempo: 0, concl: 0 };
    const ingreso = Number(l.rent_amount) + Number((l as { maintenance_fee?: number }).maintenance_fee ?? 0);
    return {
      ...(l as unknown as LeaseRow),
      maintenance_fee: Number((l as { maintenance_fee?: number }).maintenance_fee ?? 0),
      poliza_vigencia: ((l as { poliza_vigencia?: string | null }).poliza_vigencia ?? null) as string | null,
      ingreso,
      saldoVencido: a.saldo,
      diasAtraso: daysOverdue(a.oldest),
      puntualidad: a.concl > 0 ? a.aTiempo / a.concl : 1,
      pctIngreso: 0,
    };
  });

  const totalActivo = rows.filter((r) => r.status === "active").reduce((s, r) => s + r.ingreso, 0);
  for (const r of rows) r.pctIngreso = totalActivo > 0 ? r.ingreso / totalActivo : 0;
  return rows;
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
