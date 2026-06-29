"use server";

import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";

/** Firma una URL temporal del acta (entrega/vencimiento) del propio contrato. */
export async function getActaUrl(
  kind: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return { error: "No autorizado." };
  if (kind !== "entrega" && kind !== "vencimiento") return { error: "Documento inválido." };

  // RLS: solo devuelve el contrato del propio arrendatario.
  const supabase = await createClient();
  const { data: lease } = await supabase
    .from("leases")
    .select("acta_entrega_path, acta_vencimiento_path")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const path =
    kind === "entrega" ? lease?.acta_entrega_path : lease?.acta_vencimiento_path;
  if (!path) return { error: "No hay documento." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documents").createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el documento." };
  return { url: data.signedUrl };
}
