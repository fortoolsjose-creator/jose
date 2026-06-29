"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import { normalizeMxPhone } from "@/app/_lib/auth-schemas";
import { generateInviteLink } from "@/app/_lib/invite";
import type { ApplicationStatus } from "@/app/_lib/types";

const STATUSES: ApplicationStatus[] = [
  "recibida",
  "en_revision",
  "aprobada",
  "rechazada",
];

async function requireStaff() {
  const p = await getProfile();
  return !p || p.role === "tenant" ? null : p;
}

export async function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<{ ok?: true; error?: string }> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  if (!STATUSES.includes(status)) return { error: "Estado no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status }).eq("id", id);
  if (error) return { error: "No se pudo actualizar." };
  revalidatePath("/solicitudes");
  revalidatePath(`/solicitudes/${id}`);
  return { ok: true };
}

export async function getApplicationDocUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el documento." };
  return { url: data.signedUrl };
}

export type ConvertResult = {
  ok?: true;
  error?: string;
  tempPassword?: string;
  tenantEmail?: string;
  inviteLink?: string;
};

export async function convertToTenant(
  applicationId: string,
): Promise<ConvertResult> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select(
      "id, org_id, applicant_name, applicant_email, applicant_phone, guarantee_type, listing:listings(id, unit_id, rent_amount)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!app || app.org_id !== profile.org_id) return { error: "Solicitud no encontrada." };
  if (!app.applicant_email) return { error: "La solicitud no tiene correo." };

  const listing = (app as unknown as {
    listing?: { id: string; unit_id: string | null; rent_amount: number };
  }).listing;
  if (!listing?.unit_id) {
    return { error: "La vacante ya no tiene una unidad asociada." };
  }

  const { data: unit } = await admin
    .from("units")
    .select("rent_amount, deposit_amount, org_id")
    .eq("id", listing.unit_id)
    .maybeSingle();
  if (!unit || unit.org_id !== profile.org_id) return { error: "Unidad no válida." };

  // Atomically claim the application so a double-click / concurrent call can't
  // create duplicate draft leases. The second caller finds it already 'aprobada'.
  const { data: claimed } = await admin
    .from("applications")
    .update({ status: "aprobada" })
    .eq("id", applicationId)
    .eq("org_id", profile.org_id)
    .neq("status", "aprobada")
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "Esta solicitud ya fue convertida." };

  const email = app.applicant_email.toLowerCase().trim();
  let tenantId: string;
  let tempPassword: string | null = null;

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", profile.org_id)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    tenantId = existing.id;
  } else {
    tempPassword = `Llave-${randomInt(100000, 999999)}`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: app.applicant_name },
    });
    if (cErr || !created?.user) {
      await admin.from("applications").update({ status: "en_revision" }).eq("id", applicationId);
      return { error: "No se pudo crear el arrendatario (¿el correo ya está en uso?)." };
    }
    tenantId = created.user.id;
    const { error: pErr } = await admin.from("profiles").insert({
      id: tenantId,
      org_id: profile.org_id,
      role: "tenant",
      full_name: app.applicant_name,
      email,
      phone: normalizeMxPhone(app.applicant_phone ?? ""),
    });
    if (pErr) {
      await admin.from("applications").update({ status: "en_revision" }).eq("id", applicationId);
      return { error: "No se pudo crear el perfil del arrendatario." };
    }
  }

  // Draft (pending) lease — staff activates it from Arrendatarios.
  const { error: lErr } = await admin.from("leases").insert({
    org_id: profile.org_id,
    unit_id: listing.unit_id,
    tenant_profile_id: tenantId,
    rent_amount: unit.rent_amount,
    deposit_amount: unit.deposit_amount,
    payment_day: 1,
    guarantee_type: app.guarantee_type ?? "deposito",
    status: "pending",
  });
  if (lErr) {
    await admin.from("applications").update({ status: "en_revision" }).eq("id", applicationId);
    return { error: "No se pudo crear el contrato borrador." };
  }

  await admin.from("listings").update({ status: "filled" }).eq("id", listing.id);

  const inviteLink = (await generateInviteLink(admin, email)) ?? undefined;

  revalidatePath("/solicitudes");
  revalidatePath("/inquilinos");
  revalidatePath("/vacantes");
  return {
    ok: true,
    tempPassword: tempPassword ?? undefined,
    tenantEmail: email,
    inviteLink,
  };
}
