"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import { commentSchema } from "@/app/_lib/schemas";
import { notify } from "@/app/_lib/notifications";
import { isPeriodLocked } from "@/app/_lib/data/period-locks";
import { MAINTENANCE_STATUS_LABELS, type MaintenanceStatus } from "@/app/_lib/types";

const planSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título."),
  category: z.enum([
    "plomeria", "electricidad", "cerrajeria",
    "electrodomesticos", "limpieza", "otro",
  ]),
  property_id: z.string().uuid().optional().or(z.literal("")),
  frequency_months: z.coerce.number().int().min(1).max(60),
  next_due: z.string().min(1, "Selecciona la fecha."),
});

/** Crea un plan de mantenimiento preventivo (recurrente). */
export async function createPlan(input: unknown): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del plan." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_plans").insert({
    org_id: profile.org_id,
    property_id: d.property_id || null,
    title: d.title,
    category: d.category,
    frequency_months: d.frequency_months,
    next_due: d.next_due,
    active: true,
  });
  if (error) return { error: "No se pudo crear el plan." };
  revalidatePath("/mantenimiento");
  return { ok: true };
}

const registroSchema = z.object({
  title: z.string().trim().min(1, "Escribe qué se hizo."),
  category: z.enum(["plomeria", "electricidad", "cerrajeria", "electrodomesticos", "limpieza", "otro"]),
  mtype: z.enum(["correctivo", "preventivo"]),
  property_id: z.string().uuid().optional().or(z.literal("")),
  unit_id: z.string().uuid().optional().or(z.literal("")),
  worker_id: z.string().uuid().optional().or(z.literal("")),
  cost: z.coerce.number().min(0).optional(),
  fecha: z.string().min(1, "Selecciona la fecha."),
  description: z.string().optional(),
});

/** Registra un mantenimiento YA HECHO (queda como resuelto, con quién y cuánto). */
export async function registrarMantenimiento(input: unknown): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const parsed = registroSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del mantenimiento." };
  const d = parsed.data;
  const supabase = await createClient();
  if (d.cost && d.cost > 0 && (await isPeriodLocked(supabase, profile.org_id, d.fecha.slice(0, 7) + "-01"))) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo para registrar mantenimiento con costo." };
  }
  const { error } = await supabase.from("maintenance_requests").insert({
    org_id: profile.org_id,
    property_id: d.property_id || null,
    unit_id: d.unit_id || null,
    title: d.title,
    description: d.description?.trim() || null,
    category: d.category,
    mtype: d.mtype,
    priority: "media",
    status: "resuelto",
    resolved_at: new Date(d.fecha + "T12:00:00").toISOString(),
    worker_id: d.worker_id || null,
    cost: d.cost ?? null,
    created_by: profile.id,
  });
  if (error) return { error: "No se pudo registrar el mantenimiento." };
  revalidatePath("/mantenimiento");
  revalidatePath("/panel");
  return { ok: true };
}

/** Quita (desactiva) un plan preventivo. */
export async function deletePlan(planId: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_plans")
    .update({ active: false })
    .eq("id", planId)
    .eq("org_id", profile.org_id);
  if (error) return { error: "No se pudo quitar el plan." };
  revalidatePath("/mantenimiento");
  return { ok: true };
}

const STATUSES: MaintenanceStatus[] = [
  "recibido",
  "en_proceso",
  "resuelto",
  "cancelado",
];

export async function changeStatus(
  requestId: string,
  status: MaintenanceStatus,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!STATUSES.includes(status)) return { error: "Estado no válido." };
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("maintenance_requests")
    .select(
      "title, created_by_profile:profiles!maintenance_requests_created_by_fkey(email)",
    )
    .eq("id", requestId)
    .maybeSingle();

  const update: Record<string, unknown> = { status };
  if (status === "resuelto") update.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from("maintenance_requests")
    .update(update)
    .eq("id", requestId);
  if (error) return { error: "No se pudo cambiar el estado." };

  await supabase.from("request_events").insert({
    org_id: profile.org_id,
    request_id: requestId,
    actor_id: profile.id,
    type: "status_change",
    body: `Estado: ${MAINTENANCE_STATUS_LABELS[status]}`,
  });

  try {
    const email = (
      req as unknown as { created_by_profile?: { email: string | null } }
    )?.created_by_profile?.email;
    const title = (req as { title?: string })?.title ?? "tu reporte";
    if (email)
      await notify({
        to: email,
        template: "request_status_changed",
        data: { title, status: MAINTENANCE_STATUS_LABELS[status] },
      });
  } catch {
    // ignore notification errors
  }

  revalidatePath(`/mantenimiento/${requestId}`);
  revalidatePath("/mantenimiento");
  revalidatePath(`/mis-reportes/${requestId}`);
  revalidatePath("/mis-reportes");
  revalidatePath("/panel");
  return { ok: true };
}

export async function addAdminComment(
  requestId: string,
  input: unknown,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: "Escribe un mensaje." };
  const supabase = await createClient();
  const { error } = await supabase.from("request_events").insert({
    org_id: profile.org_id,
    request_id: requestId,
    actor_id: profile.id,
    type: "comment",
    body: parsed.data.body,
  });
  if (error) return { error: "No se pudo enviar el comentario." };

  // Avisar al inquilino que hay respuesta (antes solo se le avisaba al cambiar estatus).
  try {
    const { data: req } = await supabase
      .from("maintenance_requests")
      .select("title, created_by")
      .eq("id", requestId)
      .maybeSingle();
    if (req?.created_by) {
      const { data: tenant } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", req.created_by)
        .maybeSingle();
      if (tenant?.email) {
        await notify({ to: tenant.email, template: "request_replied", data: { title: req.title } });
      }
    }
  } catch {
    // el comentario ya se guardó; el aviso es best-effort
  }

  revalidatePath(`/mantenimiento/${requestId}`);
  revalidatePath(`/mis-reportes/${requestId}`);
  return { ok: true };
}
