"use server";

import { createAdminClient } from "@/app/_lib/supabase/admin";
import { applicationSchema } from "@/app/_lib/schemas";
import { notify } from "@/app/_lib/notifications";

export type ApplicationState = { ok?: true; error?: string };

const MAX = 15 * 1024 * 1024;

type AdminClient = ReturnType<typeof createAdminClient>;

async function uploadDoc(
  admin: AdminClient,
  orgId: string,
  listingId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0 || file.size > MAX) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${orgId}/applications/${listingId}/${crypto.randomUUID()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("documents")
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  return error ? null : path;
}

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  // Consentimiento del aviso de privacidad (LFPDPPP): obligatorio al recabar datos.
  if (!formData.get("privacy_accept")) {
    return { error: "Debes aceptar el aviso de privacidad para enviar tu solicitud." };
  }

  const incomeRaw = formData.get("monthly_income");
  const parsed = applicationSchema.safeParse({
    listing_id: formData.get("listing_id"),
    applicant_name: formData.get("applicant_name"),
    applicant_phone: formData.get("applicant_phone"),
    applicant_email: formData.get("applicant_email"),
    monthly_income: incomeRaw ? incomeRaw : undefined,
    guarantee_type: formData.get("guarantee_type"),
  });
  if (!parsed.success) return { error: "Revisa los datos del formulario." };
  const d = parsed.data;

  const admin = createAdminClient();

  // The listing must exist and be published — this also pins the org_id.
  const { data: listing } = await admin
    .from("listings")
    .select("id, org_id, status, deleted_at")
    .eq("id", d.listing_id)
    .maybeSingle();
  if (!listing || listing.status !== "published" || listing.deleted_at) {
    return { error: "Esta vacante ya no está disponible." };
  }

  // Lightweight anti-abuse. NOTE (production): this is an unauthenticated
  // endpoint — also add a CAPTCHA (Turnstile/hCaptcha) and per-IP rate limiting.
  const files = [
    formData.get("income_proof"),
    formData.get("id_doc"),
    formData.get("guarantee_doc"),
  ].filter((f): f is File => f instanceof File && f.size > 0);
  if (files.reduce((s, f) => s + f.size, 0) > 30 * 1024 * 1024) {
    return { error: "Los archivos pesan demasiado (máximo 30 MB en total)." };
  }
  // Soft dedup against double-submit / trivial repeat from the same email.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dup } = await admin
    .from("applications")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("applicant_email", d.applicant_email)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (dup) return { ok: true };

  const incomeProof = await uploadDoc(admin, listing.org_id, listing.id, formData.get("income_proof") as File | null);
  const idDoc = await uploadDoc(admin, listing.org_id, listing.id, formData.get("id_doc") as File | null);
  const guaranteeDoc = await uploadDoc(admin, listing.org_id, listing.id, formData.get("guarantee_doc") as File | null);

  const { error } = await admin.from("applications").insert({
    org_id: listing.org_id,
    listing_id: listing.id,
    applicant_name: d.applicant_name,
    applicant_phone: d.applicant_phone || null,
    applicant_email: d.applicant_email,
    monthly_income: d.monthly_income ?? null,
    income_proof_url: incomeProof,
    id_doc_url: idDoc,
    guarantee_type: d.guarantee_type,
    guarantee_doc_url: guaranteeDoc,
    status: "recibida",
    privacy_accepted_at: new Date().toISOString(),
  });
  if (error) return { error: "No se pudo enviar la solicitud. Intenta de nuevo." };

  try {
    const { data: staff } = await admin
      .from("profiles")
      .select("email")
      .eq("org_id", listing.org_id)
      .in("role", ["owner", "staff"]);
    for (const s of (staff ?? []).slice(0, 5)) {
      if (s.email)
        await notify({
          to: s.email,
          template: "request_received",
          data: { title: `Nueva solicitud de ${d.applicant_name}` },
        });
    }
  } catch {
    // ignore
  }

  return { ok: true };
}
