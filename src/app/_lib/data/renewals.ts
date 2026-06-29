import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

export type RenewalRow = {
  lease_id: string;
  tenant: string;
  unit: string;
  end_date: string;
  dias: number;
  rent: number;
  ingreso: number; // renta + cuota
  start_date: string | null;
};

export type RenewalCalendar = {
  vencidos: RenewalRow[];
  esteMes: RenewalRow[]; // 0–30 días
  proximos: RenewalRow[]; // 31–90 días
  adelante: RenewalRow[]; // +90 días
  sinFecha: number;
  total: number;
};

export async function getRenewalCalendar(): Promise<RenewalCalendar> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leases")
    .select(
      "id, end_date, start_date, rent_amount, maintenance_fee, unit:units(label, property:properties(name)), tenant:profiles(full_name, email)",
    )
    .eq("status", "active")
    .is("deleted_at", null);

  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const out: RenewalCalendar = {
    vencidos: [],
    esteMes: [],
    proximos: [],
    adelante: [],
    sinFecha: 0,
    total: (data ?? []).length,
  };

  for (const l of data ?? []) {
    const lease = l as unknown as {
      id: string;
      end_date: string | null;
      start_date: string | null;
      rent_amount: number;
      maintenance_fee: number | null;
      unit?: { label: string; property?: { name: string } | null } | null;
      tenant?: { full_name: string | null; email: string | null } | null;
    };
    if (!lease.end_date) {
      out.sinFecha += 1;
      continue;
    }
    const dias = Math.round((Date.parse(lease.end_date + "T00:00:00Z") - today) / 86_400_000);
    const row: RenewalRow = {
      lease_id: lease.id,
      tenant: lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario",
      unit: [lease.unit?.property?.name, lease.unit?.label].filter(Boolean).join(" · "),
      end_date: lease.end_date,
      dias,
      rent: Number(lease.rent_amount),
      ingreso: Number(lease.rent_amount) + Number(lease.maintenance_fee ?? 0),
      start_date: lease.start_date,
    };
    if (dias < 0) out.vencidos.push(row);
    else if (dias <= 30) out.esteMes.push(row);
    else if (dias <= 90) out.proximos.push(row);
    else out.adelante.push(row);
  }

  const bydate = (a: RenewalRow, b: RenewalRow) => (a.end_date < b.end_date ? -1 : 1);
  out.vencidos.sort(bydate);
  out.esteMes.sort(bydate);
  out.proximos.sort(bydate);
  out.adelante.sort(bydate);
  return out;
}
