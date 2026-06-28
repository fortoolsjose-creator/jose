import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";

// Fondo de mantenimiento por edificio: cuotas de mantenimiento COBRADAS menos
// gastos de mantenimiento. El saldo acumulado es el "colchón" de cada edificio.
export type FundRow = {
  property_id: string;
  name: string;
  base: number; // saldo base (colchón al corte, provisional)
  baseNote: string | null;
  ingresoMes: number;
  egresoMes: number;
  fondoMes: number;
  ingresoAcum: number;
  egresoAcum: number;
  fondoAcum: number; // base + ingresoAcum − egresoAcum
};

export type FundTotals = Omit<FundRow, "property_id" | "name" | "baseNote">;

export type MaintenanceFund = {
  period: string;
  rows: FundRow[];
  totals: FundTotals;
  sinAsignar: number; // gastos de mantenimiento sin propiedad (no entran al fondo de un edificio)
  hasProvisional: boolean;
};

export async function getMaintenanceFund(): Promise<MaintenanceFund> {
  const supabase = await createClient();
  const period = currentPeriod();

  const [{ data: props }, { data: fees }, { data: exps }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, maintenance_fund_opening, maintenance_fund_opening_note")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("maintenance_fees")
      .select("amount_paid, paid_date, lease:leases(unit:units(property_id))")
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("amount, period_month, expense_date, property_id")
      .eq("category", "mantenimiento")
      .is("deleted_at", null),
  ]);

  const map = new Map<string, FundRow>();
  for (const p of props ?? []) {
    map.set(p.id as string, {
      property_id: p.id as string,
      name: p.name as string,
      base: Number(p.maintenance_fund_opening) || 0,
      baseNote: (p.maintenance_fund_opening_note as string | null) ?? null,
      ingresoMes: 0,
      egresoMes: 0,
      fondoMes: 0,
      ingresoAcum: 0,
      egresoAcum: 0,
      fondoAcum: 0,
    });
  }

  // Ingresos: cuotas de mantenimiento cobradas (amount_paid).
  for (const f of fees ?? []) {
    const pid = (f as unknown as { lease?: { unit?: { property_id?: string } | null } | null })
      .lease?.unit?.property_id;
    const amt = Number(f.amount_paid) || 0;
    if (!pid || amt === 0 || !map.has(pid)) continue;
    const r = map.get(pid)!;
    r.ingresoAcum += amt;
    // El ingreso del mes se cuenta por cuándo entró el dinero (paid_date), no por
    // el mes al que corresponde la cuota — así "movimiento del mes" es flujo real.
    const paidMonth = f.paid_date ? String(f.paid_date).slice(0, 7) + "-01" : null;
    if (paidMonth === period) r.ingresoMes += amt;
  }

  // Egresos: gastos categoría "mantenimiento".
  let sinAsignar = 0;
  for (const e of exps ?? []) {
    const amt = Number(e.amount) || 0;
    const pid = (e.property_id as string | null) ?? null;
    // Base de caja (consistente con el ingreso por paid_date): el egreso del mes
    // se cuenta por cuándo ocurrió el gasto (expense_date), no por el mes imputado.
    const eperiod =
      (e.expense_date ? String(e.expense_date).slice(0, 7) + "-01" : null) ??
      (e.period_month as string | null);
    if (!pid || !map.has(pid)) {
      sinAsignar += amt;
      continue;
    }
    const r = map.get(pid)!;
    r.egresoAcum += amt;
    if (eperiod === period) r.egresoMes += amt;
  }

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      fondoMes: r.ingresoMes - r.egresoMes,
      fondoAcum: r.base + r.ingresoAcum - r.egresoAcum,
    }))
    .filter((r) => r.base !== 0 || r.ingresoAcum !== 0 || r.egresoAcum !== 0)
    .sort((a, b) => b.fondoAcum - a.fondoAcum);

  const totals = rows.reduce<FundTotals>(
    (t, r) => ({
      base: t.base + r.base,
      ingresoMes: t.ingresoMes + r.ingresoMes,
      egresoMes: t.egresoMes + r.egresoMes,
      fondoMes: t.fondoMes + r.fondoMes,
      ingresoAcum: t.ingresoAcum + r.ingresoAcum,
      egresoAcum: t.egresoAcum + r.egresoAcum,
      fondoAcum: t.fondoAcum + r.fondoAcum,
    }),
    { base: 0, ingresoMes: 0, egresoMes: 0, fondoMes: 0, ingresoAcum: 0, egresoAcum: 0, fondoAcum: 0 },
  );

  return { period, rows, totals, sinAsignar, hasProvisional: rows.some((r) => r.base !== 0) };
}
