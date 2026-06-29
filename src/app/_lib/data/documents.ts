import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import type { DocumentOwnerType } from "@/app/_lib/types";

export type DocRow = {
  id: string;
  owner_type: string;
  owner_id: string;
  name: string;
  url: string; // ruta dentro del bucket privado "documents"
  kind: string | null;
  created_at: string;
  signedUrl: string | null;
};

/**
 * Documentos del expediente de un dueño (arrendatario/propiedad/unidad/contrato),
 * con URL firmada lista para descargar. RLS limita a la org del staff; las URLs
 * se firman con el cliente admin (el staff puede leer todo lo de su org).
 */
export async function listDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<DocRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, owner_type, owner_id, name, url, kind, created_at")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Omit<DocRow, "signedUrl">[];
  const admin = createAdminClient();
  const signed: DocRow[] = await Promise.all(
    rows.map(async (r) => {
      const { data: s } = await admin.storage
        .from("documents")
        .createSignedUrl(r.url, 600);
      return { ...r, signedUrl: s?.signedUrl ?? null };
    }),
  );
  return signed;
}
