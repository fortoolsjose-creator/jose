"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";

const refSchema = z.object({
  reference: z.string().trim().min(3, "Escribe tu clave de rastreo."),
  method: z.enum(["spei", "cash", "oxxo", "other"]).optional(),
});

export async function markAsPaid(
  paymentId: string,
  input: unknown,
  proofPath?: string | null,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return { error: "No autorizado." };
  const parsed = refSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Escribe tu clave de rastreo (mínimo 3 caracteres)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("tenant_submit_payment_reference", {
    p_payment_id: paymentId,
    p_reference: parsed.data.reference,
    p_method: parsed.data.method ?? "spei",
  });
  if (error) {
    return {
      error: error.message.includes("pagado")
        ? "Este recibo ya está pagado."
        : "No se pudo enviar. Intenta de nuevo.",
    };
  }

  // Guarda la imagen del comprobante (solo si está en la carpeta del propio
  // inquilino). El inquilino no puede actualizar payments por RLS, así que tras
  // verificar que el pago es suyo, lo escribimos con el cliente admin.
  if (
    typeof proofPath === "string" &&
    proofPath.startsWith(`${profile.org_id}/${profile.id}/`)
  ) {
    const admin = createAdminClient();
    const { data: pay } = await admin
      .from("payments")
      .select("id, lease:leases(tenant_profile_id)")
      .eq("id", paymentId)
      .maybeSingle();
    const ownerId = (pay as unknown as { lease?: { tenant_profile_id: string | null } })
      ?.lease?.tenant_profile_id;
    if (ownerId === profile.id) {
      await admin.from("payments").update({ proof_path: proofPath }).eq("id", paymentId);
    }
  }

  revalidatePath("/mi-renta");
  return { ok: true };
}

export async function getProofUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "No autorizado." };
  // RLS sobre payments solo deja ver los pagos del propio inquilino: si el
  // comprobante pertenece a uno de ellos, lo firmamos con admin (el staff lo sube
  // a {org}/comprobantes/... que la RLS de Storage del inquilino no alcanza).
  const supabase = await createClient();
  const { data: pay } = await supabase
    .from("payments")
    .select("id")
    .eq("proof_path", path)
    .maybeSingle();
  if (!pay) return { error: "No se pudo abrir el comprobante." };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el comprobante." };
  return { url: data.signedUrl };
}

export async function getReceiptUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "No autorizado." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el recibo." };
  return { url: data.signedUrl };
}
