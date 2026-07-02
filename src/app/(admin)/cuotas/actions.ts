"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import { isPeriodLocked } from "@/app/_lib/data/period-locks";

const schema = z.object({
  method: z.enum(["spei", "cash", "oxxo", "card", "other"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0."),
  paid_date: z.string().min(1),
});

export async function confirmFee(
  feeId: string,
  input: unknown,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: fee } = await supabase
    .from("maintenance_fees")
    .select("id, amount_due, amount_paid, period_month")
    .eq("id", feeId)
    .maybeSingle();
  if (!fee) return { error: "Cuota no encontrada." };
  if (await isPeriodLocked(supabase, profile.org_id, fee.period_month as string)) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo para registrar cuotas." };
  }

  // Acumula los abonos (no sobrescribe): el 2º pago parcial se suma al 1º.
  const newPaid = Math.round((Number(fee.amount_paid ?? 0) + d.amount) * 100) / 100;
  const status = newPaid >= Number(fee.amount_due) ? "paid" : "partial";
  const { error } = await supabase
    .from("maintenance_fees")
    .update({
      amount_paid: newPaid,
      paid_date: d.paid_date,
      method: d.method,
      status,
    })
    .eq("id", feeId);
  if (error) return { error: "No se pudo registrar el pago de la cuota." };

  revalidatePath("/cuotas");
  revalidatePath("/panel");
  return { ok: true };
}
