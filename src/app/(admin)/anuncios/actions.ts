"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

type Result = { ok?: true; error?: string };

export async function createAnnouncement(input: {
  title: string;
  body?: string;
  property_id?: string;
  until?: string;
}): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const title = (input.title ?? "").trim();
  if (!title) return { error: "Escribe un título." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    org_id: profile.org_id,
    title,
    body: input.body?.trim() || null,
    property_id: input.property_id || null,
    until: input.until || null,
  });
  if (error) return { error: "No se pudo publicar el aviso." };
  revalidatePath("/anuncios");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/anuncios");
  return { ok: true };
}
