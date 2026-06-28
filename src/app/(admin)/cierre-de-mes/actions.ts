"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

export async function toggleProcess(
  processNo: number,
  period: string,
  done: boolean,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("process_completions").upsert(
    {
      org_id: profile.org_id,
      process_no: processNo,
      period_month: period,
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? profile.id : null,
    },
    { onConflict: "org_id,process_no,period_month" },
  );
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/cierre-de-mes");
  return { ok: true };
}

/** Cierra un mes: bloquea nuevas escrituras de gastos/cobros de ese periodo. */
export async function lockPeriod(period: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!/^\d{4}-\d{2}-01$/.test(period)) return { error: "Periodo no válido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("period_locks")
    .upsert(
      { org_id: profile.org_id, period_month: period, locked_at: new Date().toISOString(), locked_by: profile.id },
      { onConflict: "org_id,period_month" },
    );
  if (error) return { error: "No se pudo cerrar el mes." };
  revalidatePath("/cierre-de-mes");
  return { ok: true };
}

/** Reabre un mes cerrado. Solo el dueño. */
export async function unlockPeriod(period: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") return { error: "Solo el dueño puede reabrir un mes." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("period_locks")
    .delete()
    .eq("org_id", profile.org_id)
    .eq("period_month", period);
  if (error) return { error: "No se pudo reabrir el mes." };
  revalidatePath("/cierre-de-mes");
  return { ok: true };
}
