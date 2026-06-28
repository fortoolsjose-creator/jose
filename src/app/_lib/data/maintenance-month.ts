import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";
import type { MaintenanceType } from "@/app/_lib/types";

export type MttoMonthRow = {
  id: string;
  title: string;
  unit: string;
  tipo: MaintenanceType;
  quien: string | null;
  cost: number;
  fecha: string;
};

export type MttoMonth = {
  period: string;
  rows: MttoMonthRow[];
  total: number;
  preventivo: number;
  correctivo: number;
  totalCost: number;
  porEdificio: { name: string; n: number }[];
};

/** Mantenimientos resueltos en el mes actual: qué se hizo, quién y cuánto. */
export async function getMaintenanceMonth(): Promise<MttoMonth> {
  const supabase = await createClient();
  const period = currentPeriod();
  const prefix = period.slice(0, 7); // YYYY-MM
  const { data } = await supabase
    .from("maintenance_requests")
    .select(
      "id, title, mtype, cost, resolved_at, property:properties(name), unit:units(label, property:properties(name)), worker:workers(name)",
    )
    .eq("status", "resuelto")
    .not("resolved_at", "is", null)
    .is("deleted_at", null);

  const rows: MttoMonthRow[] = [];
  const edif = new Map<string, number>();
  let preventivo = 0,
    correctivo = 0,
    totalCost = 0;

  for (const r of data ?? []) {
    const row = r as unknown as {
      id: string;
      title: string;
      mtype: MaintenanceType;
      cost: number | null;
      resolved_at: string | null;
      property?: { name: string } | null;
      unit?: { label: string; property?: { name: string } | null } | null;
      worker?: { name: string } | null;
    };
    if (!row.resolved_at || !String(row.resolved_at).startsWith(prefix)) continue;
    const cost = Number(row.cost) || 0;
    const propName = row.property?.name ?? row.unit?.property?.name ?? "Sin edificio";
    if (row.mtype === "preventivo") preventivo += 1;
    else correctivo += 1;
    totalCost += cost;
    edif.set(propName, (edif.get(propName) ?? 0) + 1);
    rows.push({
      id: row.id,
      title: row.title,
      unit: [propName !== "Sin edificio" ? propName : null, row.unit?.label].filter(Boolean).join(" · ") || "General",
      tipo: row.mtype,
      quien: row.worker?.name ?? null,
      cost,
      fecha: String(row.resolved_at).slice(0, 10),
    });
  }

  rows.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return {
    period,
    rows,
    total: rows.length,
    preventivo,
    correctivo,
    totalCost,
    porEdificio: [...edif.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
  };
}
