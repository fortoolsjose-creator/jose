"use server";

import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import type { DocumentOwnerType } from "@/app/_lib/types";

const OWNER_TYPES: DocumentOwnerType[] = ["profile", "property", "unit", "lease"];

/** Registra un documento ya subido al bucket "documents" en el expediente. */
export async function addDocument(input: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  kind: string;
  name: string;
  path: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!OWNER_TYPES.includes(input.ownerType)) return { error: "Tipo inválido." };
  if (typeof input.path !== "string" || !input.path.startsWith(`${profile.org_id}/`))
    return { error: "Ruta inválida." };

  const admin = createAdminClient();
  const { error } = await admin.from("documents").insert({
    org_id: profile.org_id,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    kind: input.kind || "otro",
    name: input.name.slice(0, 200),
    url: input.path,
  });
  if (error) return { error: "No se pudo guardar el documento." };
  return { ok: true };
}

/** Quita un documento del expediente (borrado suave). */
export async function deleteDocument(
  docId: string,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("id, org_id, url")
    .eq("id", docId)
    .maybeSingle();
  if (!doc || doc.org_id !== profile.org_id) return { error: "Documento no válido." };
  const { error } = await admin
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) return { error: "No se pudo quitar el documento." };
  // Borra también el archivo del bucket (datos sensibles: INE, comprobantes).
  if (doc.url) await admin.storage.from("documents").remove([doc.url as string]);
  return { ok: true };
}
