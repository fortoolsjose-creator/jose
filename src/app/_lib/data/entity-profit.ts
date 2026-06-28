import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";

export type EntityProfit = {
  entity_id: string | null;
  nombre: string;
  ingreso: number; // renta + cuota de contratos activos de sus edificios
  gastos: number; // gastos directos de sus edificios + prorrateados (del periodo)
  noi: number;
  edificios: number;
};

/** Estado de resultados por sociedad (CIT/PH/SPH/CIMMA) del periodo. */
export async function getEntityProfitability(period?: string): Promise<EntityProfit[]> {
  const supabase = await createClient();
  const p = period ?? currentPeriod();

  const [{ data: ents }, { data: props }, { data: leases }, { data: exps }, { data: allocs }] =
    await Promise.all([
      supabase.from("legal_entities").select("id, nombre").is("deleted_at", null),
      supabase.from("properties").select("id, entity_id").is("deleted_at", null),
      supabase
        .from("leases")
        .select("rent_amount, maintenance_fee, unit:units(property_id)")
        .eq("status", "active")
        .is("deleted_at", null),
      supabase.from("expenses").select("id, amount, property_id").eq("period_month", p).is("deleted_at", null),
      supabase
        .from("expense_allocations")
        .select("entity_id, amount, expense_id, expense:expenses(period_month, deleted_at)"),
    ]);

  const entList = ents ?? [];
  const nameOf = (id: string | null) => entList.find((e) => e.id === id)?.nombre ?? "Sin sociedad";
  const entityOfProp = new Map<string, string | null>();
  for (const pr of props ?? []) entityOfProp.set(pr.id as string, (pr.entity_id as string | null) ?? null);

  const SIN = "__sin__";
  const map = new Map<string, EntityProfit>();
  const ensure = (id: string | null) => {
    const key = id ?? SIN;
    if (!map.has(key))
      map.set(key, { entity_id: id, nombre: nameOf(id), ingreso: 0, gastos: 0, noi: 0, edificios: 0 });
    return map.get(key)!;
  };
  for (const e of entList) ensure(e.id);
  ensure(null);

  for (const pr of props ?? []) ensure((pr.entity_id as string | null) ?? null).edificios += 1;

  for (const l of leases ?? []) {
    const pid = (l as unknown as { unit?: { property_id: string | null } }).unit?.property_id ?? null;
    const ent = pid ? entityOfProp.get(pid) ?? null : null;
    ensure(ent).ingreso += Number(l.rent_amount) + Number(l.maintenance_fee ?? 0);
  }

  // Gastos compartidos (con reparto) se ignoran aquí y se suman por allocation,
  // para no contarlos doble.
  const allocatedIds = new Set<string>();
  for (const a of allocs ?? []) {
    const exp = (a as unknown as { expense?: { period_month: string; deleted_at: string | null } }).expense;
    if (!exp || exp.deleted_at || exp.period_month !== p) continue;
    allocatedIds.add(a.expense_id as string);
  }

  for (const ex of exps ?? []) {
    if (allocatedIds.has(ex.id as string)) continue;
    const pid = ex.property_id as string | null;
    const ent = pid ? entityOfProp.get(pid) ?? null : null;
    ensure(ent).gastos += Number(ex.amount);
  }

  for (const a of allocs ?? []) {
    const exp = (a as unknown as { expense?: { period_month: string; deleted_at: string | null } }).expense;
    if (!exp || exp.deleted_at || exp.period_month !== p) continue;
    ensure((a.entity_id as string | null) ?? null).gastos += Number(a.amount);
  }

  const out = [...map.values()];
  for (const e of out) e.noi = e.ingreso - e.gastos;
  return out
    .filter((e) => e.edificios > 0 || e.ingreso > 0 || e.gastos > 0)
    .sort((a, b) => b.noi - a.noi);
}
