"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import { requestSchema, commentSchema, type RequestInput } from "@/app/_lib/schemas";
import { notify } from "@/app/_lib/notifications";

export type CreateRequestResult = { ok?: true; error?: string; id?: string };

export async function createRequest(
  input: RequestInput,
  photoPath?: string | null,
): Promise<CreateRequestResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return { error: "No autorizado." };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del reporte." };
  const d = parsed.data;
  // Acepta solo una ruta dentro de la carpeta del propio inquilino (anti-spoof).
  const safePhoto =
    typeof photoPath === "string" &&
    photoPath.startsWith(`${profile.org_id}/${profile.id}/`)
      ? photoPath
      : null;

  // Trusted server action: use admin client so we can also write the "created"
  // timeline event (tenant RLS only allows comment/photo events).
  const admin = createAdminClient();

  const { data: lease } = await admin
    .from("leases")
    .select("id, unit_id")
    .eq("tenant_profile_id", profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: req, error } = await admin
    .from("maintenance_requests")
    .insert({
      org_id: profile.org_id,
      unit_id: lease?.unit_id ?? null,
      lease_id: lease?.id ?? null,
      created_by: profile.id,
      title: d.title,
      category: d.category,
      description: d.description?.trim() || null,
      priority: "media",
      status: "recibido",
    })
    .select("id")
    .single();
  if (error || !req) return { error: "No se pudo enviar el reporte." };

  await admin.from("request_events").insert({
    org_id: profile.org_id,
    request_id: req.id,
    actor_id: profile.id,
    type: "created",
    body: "Reporte creado por el inquilino.",
  });

  if (safePhoto) {
    await admin.from("request_events").insert({
      org_id: profile.org_id,
      request_id: req.id,
      actor_id: profile.id,
      type: "photo",
      body: "Foto del problema",
      photo_url: safePhoto,
    });
  }

  // Notify the org's staff (best-effort).
  try {
    const { data: staff } = await admin
      .from("profiles")
      .select("email")
      .eq("org_id", profile.org_id)
      .in("role", ["owner", "staff"]);
    for (const s of staff ?? []) {
      if (s.email)
        await notify({ to: s.email, template: "request_received", data: { title: d.title } });
    }
  } catch {
    // ignore notification errors
  }

  revalidatePath("/mis-reportes");
  revalidatePath("/mantenimiento");
  revalidatePath("/panel");
  return { ok: true, id: req.id };
}

export async function submitRating(
  requestId: string,
  rating: number,
  comment?: string,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return { error: "No autorizado." };
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { error: "Calificación no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("satisfaction_ratings").insert({
    org_id: profile.org_id,
    request_id: requestId,
    rating: r,
    comment: comment?.trim() || null,
    created_by: profile.id,
  });
  if (error) return { error: "No se pudo enviar tu calificación." };
  revalidatePath(`/mis-reportes/${requestId}`);
  return { ok: true };
}

export async function addTenantComment(
  requestId: string,
  input: unknown,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return { error: "No autorizado." };
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
  revalidatePath(`/mis-reportes/${requestId}`);
  return { ok: true };
}
