"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import { normalizeMxPhone } from "@/app/_lib/auth-schemas";
import { generateInviteLink } from "@/app/_lib/invite";
import type { ProspectStage } from "@/app/_lib/types";

type Result = { ok?: true; error?: string };

const STAGES: ProspectStage[] = ["prospecto", "evaluacion", "aprobado", "rechazado", "papeleo", "cliente"];
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function createProspect(input: {
  name: string;
  is_company?: boolean;
  contact_phone?: string;
  contact_email?: string;
  property_id?: string;
  unit_id?: string;
  giro?: string;
  impacto?: string;
  monthly_income?: unknown;
  rent_target?: unknown;
  guarantee_type?: string;
  notes?: string;
}): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const name = (input.name ?? "").trim();
  if (!name) return { error: "Escribe el nombre del prospecto." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").insert({
    org_id: profile.org_id,
    name,
    is_company: !!input.is_company,
    contact_phone: input.contact_phone?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    property_id: input.property_id || null,
    unit_id: input.unit_id || null,
    giro: input.giro?.trim() || null,
    impacto: input.impacto?.trim() || null,
    monthly_income: num(input.monthly_income),
    rent_target: num(input.rent_target),
    guarantee_type: input.guarantee_type || null,
    notes: input.notes?.trim() || null,
    stage: "prospecto",
  });
  if (error) return { error: "No se pudo crear el prospecto." };
  revalidatePath("/prospectos");
  return { ok: true };
}

export async function setProspectStage(id: string, stage: ProspectStage): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!STAGES.includes(stage)) return { error: "Etapa no válida." };
  const supabase = await createClient();

  // No se puede pasar a "Cliente" sin el papeleo completo.
  if (stage === "cliente") {
    const { data: p } = await supabase
      .from("prospects")
      .select("contrato_ok, pagare_ok, garantia_ok, acta_ok")
      .eq("id", id)
      .maybeSingle();
    if (p && !(p.contrato_ok && p.pagare_ok && p.garantia_ok && p.acta_ok)) {
      return { error: "Falta papeleo: contrato, pagaré, garantía y acta de entrega." };
    }
  }

  const { error } = await supabase.from("prospects").update({ stage }).eq("id", id);
  if (error) return { error: "No se pudo cambiar la etapa." };
  revalidatePath("/prospectos");
  return { ok: true };
}

export async function setProspectPapeleo(
  id: string,
  field: "contrato_ok" | "pagare_ok" | "garantia_ok" | "acta_ok",
  value: boolean,
): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!["contrato_ok", "pagare_ok", "garantia_ok", "acta_ok"].includes(field))
    return { error: "Campo no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ [field]: value }).eq("id", id);
  if (error) return { error: "No se pudo actualizar." };
  revalidatePath("/prospectos");
  return { ok: true };
}

export type ConvertProspectResult = {
  ok?: true;
  error?: string;
  tempPassword?: string;
  tenantEmail?: string;
  inviteLink?: string;
};

/**
 * Convierte un prospecto en arrendatario: crea (o reusa) su acceso, un contrato
 * BORRADOR (pending) en la unidad asignada, y enlaza/cierra el prospecto.
 * Espejo de convertToTenant (Solicitudes): claim atómico + rollback si falla.
 */
export async function convertProspectToTenant(
  prospectId: string,
): Promise<ConvertProspectResult> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();

  const { data: p } = await admin
    .from("prospects")
    .select(
      "id, org_id, name, contact_email, contact_phone, unit_id, rent_target, guarantee_type, contrato_ok, pagare_ok, garantia_ok, acta_ok, converted_at",
    )
    .eq("id", prospectId)
    .maybeSingle();
  if (!p || p.org_id !== profile.org_id) return { error: "Prospecto no encontrado." };
  if (p.converted_at) return { error: "Este prospecto ya se convirtió en arrendatario." };
  if (!p.unit_id) return { error: "Asigna una unidad al prospecto antes de convertirlo." };
  if (!(p.contrato_ok && p.pagare_ok && p.garantia_ok && p.acta_ok))
    return { error: "Completa el papeleo (contrato, pagaré, garantía y acta) antes de convertir." };
  const email = (p.contact_email ?? "").toLowerCase().trim();
  if (!email) return { error: "Captura el correo del prospecto para crear su acceso." };

  const { data: unit } = await admin
    .from("units")
    .select("rent_amount, deposit_amount, org_id")
    .eq("id", p.unit_id)
    .maybeSingle();
  if (!unit || unit.org_id !== profile.org_id) return { error: "Unidad no válida." };

  // Claim atómico: marca converted_at solo si está null → evita doble conversión.
  const { data: claimed } = await admin
    .from("prospects")
    .update({ converted_at: new Date().toISOString() })
    .eq("id", prospectId)
    .eq("org_id", profile.org_id)
    .is("converted_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "Este prospecto ya se convirtió." };

  const rollback = async () =>
    void (await admin.from("prospects").update({ converted_at: null }).eq("id", prospectId));

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
      user_metadata: { full_name: p.name },
    });
    if (cErr || !created?.user) {
      await rollback();
      return { error: "No se pudo crear el arrendatario (¿el correo ya está en uso?)." };
    }
    tenantId = created.user.id;
    const { error: pErr } = await admin.from("profiles").insert({
      id: tenantId,
      org_id: profile.org_id,
      role: "tenant",
      full_name: p.name,
      email,
      phone: normalizeMxPhone(p.contact_phone ?? ""),
    });
    if (pErr) {
      await rollback();
      return { error: "No se pudo crear el perfil del arrendatario." };
    }
  }

  // Contrato borrador (pending) — staff lo activa/ajusta en Arrendatarios.
  // Renta = lo negociado con el prospecto si existe, si no la de la unidad.
  const rent = p.rent_target && p.rent_target > 0 ? p.rent_target : unit.rent_amount;
  const { data: lease, error: lErr } = await admin
    .from("leases")
    .insert({
      org_id: profile.org_id,
      unit_id: p.unit_id,
      tenant_profile_id: tenantId,
      rent_amount: rent,
      deposit_amount: unit.deposit_amount,
      payment_day: 1,
      guarantee_type: p.guarantee_type ?? "deposito",
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (lErr || !lease) {
    await rollback();
    return { error: "No se pudo crear el contrato borrador." };
  }

  await admin.from("prospects").update({ lease_id: lease.id, stage: "cliente" }).eq("id", prospectId);

  const inviteLink = (await generateInviteLink(admin, email)) ?? undefined;

  revalidatePath("/prospectos");
  revalidatePath("/inquilinos");
  return { ok: true, tempPassword: tempPassword ?? undefined, tenantEmail: email, inviteLink };
}

export async function deleteProspect(id: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/prospectos");
  return { ok: true };
}
