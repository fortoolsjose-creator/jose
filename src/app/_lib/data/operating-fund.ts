import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";

// Fondo de operación por edificio: rentas COBRADAS menos gastos de operación
// (todo lo que NO es mantenimiento). El saldo acumulado = saldo base + lo
// cobrado − lo gastado en operación.
export type OpFundRow = {
  property_id: string;
  name: string;
  base: number;
  baseNote: string | null;
  ingresoMes: number;
  egresoMes: number;
  fondoMes: number;
  ingresoAcum: number;
  egresoAcum: number;
  fondoAcum: number;
};

export type OpFundTotals = Omit<OpFundRow, "property_id" | "name" | "baseNote">;

export type OperatingFund = {
  period: string;
  rows: OpFundRow[];
  totals: OpFundTotals;
  sinAsignar: number;
  hasProvisional: boolean;
};

export async function getOperatingFund(): Promise<OperatingFund> {
  const supabase = await createClient();
  const period = currentPeriod();

  const [{ data: props }, { data: pays }, { data: exps }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, operating_fund_opening, operating_fund_opening_note")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("payments")
      .select("amount_paid, paid_date, lease:leases(unit:units(property_id))")
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("amount, period_month, expense_date, property_id")
      .neq("category", "mantenimiento")
      .is("deleted_at", null),
  ]);

  const map = new Map<string, OpFundRow>();
  for (const p of props ?? []) {
    map.set(p.id as string, {
      property_id: p.id as string,
      name: p.name as string,
      base: Number(p.operating_fund_opening) || 0,
      baseNote: (p.operating_fund_opening_note as string | null) ?? null,
      ingresoMes: 0,
      egresoMes: 0,
      fondoMes: 0,
      ingresoAcum: 0,
      egresoAcum: 0,
      fondoAcum: 0,
    });
  }

  // Ingresos: rentas cobradas (amount_paid), atribuidas por cuándo se cobraron.
  for (const pay of pays ?? []) {
    const pid = (pay as unknown as { lease?: { unit?: { property_id?: string } | null } | null })
      .lease?.unit?.property_id;
    const amt = Number(pay.amount_paid) || 0;
    if (!pid || amt === 0 || !map.has(pid)) continue;
    const r = map.get(pid)!;
    r.ingresoAcum += amt;
    const paidMonth = pay.paid_date ? String(pay.paid_date).slice(0, 7) + "-01" : null;
    if (paidMonth === period) r.ingresoMes += amt;
  }

  // Egresos: gastos de operación (todo lo que no es mantenimiento).
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

  const totals = rows.reduce<OpFundTotals>(
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
