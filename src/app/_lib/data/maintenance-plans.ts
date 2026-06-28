import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import type { MaintenanceCategory } from "@/app/_lib/types";

export type PlanRow = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  frequency_months: number;
  next_due: string;
  active: boolean;
  property: { name: string } | null;
  unit: { label: string } | null;
};

export async function listPlans(): Promise<PlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_plans")
    .select(
      "id, title, category, frequency_months, next_due, active, property:properties(name), unit:units(label)",
    )
    .eq("active", true)
    .order("next_due", { ascending: true });
  return (data ?? []) as unknown as PlanRow[];
}

/**
 * Genera tickets de mantenimiento PREVENTIVO de los planes vencidos
 * (next_due <= hoy), avanzando next_due a la siguiente ocurrencia futura para no
 * duplicar. Espejo de ensureCurrentPayments(); se llama al abrir /mantenimiento.
 */
export async function ensureDuePreventive(): Promise<void> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: due } = await supabase
    .from("maintenance_plans")
    .select("id, org_id, unit_id, title, category, frequency_months, next_due")
    .eq("active", true)
    .lte("next_due", today);

  for (const pl of due ?? []) {
    const { data: req } = await supabase
      .from("maintenance_requests")
      .insert({
        org_id: pl.org_id,
        unit_id: pl.unit_id,
        title: pl.title,
        category: pl.category,
        priority: "media",
        status: "recibido",
        mtype: "preventivo",
        plan_id: pl.id,
        scheduled_for: pl.next_due,
      })
      .select("id")
      .single();
    if (req) {
      await supabase.from("request_events").insert({
        org_id: pl.org_id,
        request_id: req.id,
        actor_id: profile.id,
        type: "created",
        body: "Mantenimiento preventivo programado.",
      });
    }
    const freq = Math.max(1, pl.frequency_months || 1);
    const nd = new Date(pl.next_due + "T00:00:00Z");
    do {
      nd.setUTCMonth(nd.getUTCMonth() + freq);
    } while (nd.toISOString().slice(0, 10) <= today);
    await supabase
      .from("maintenance_plans")
      .update({ next_due: nd.toISOString().slice(0, 10) })
      .eq("id", pl.id);
  }
}
