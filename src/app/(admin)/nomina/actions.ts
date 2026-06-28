"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

export async function createWorker(input: {
  name: string;
  role?: string;
  pay_frequency?: string;
  notes?: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const name = (input.name ?? "").trim();
  if (!name) return { error: "Escribe el nombre." };
  const supabase = await createClient();
  const { error } = await supabase.from("workers").insert({
    org_id: profile.org_id,
    name,
    role: input.role?.trim() || null,
    pay_frequency: input.pay_frequency?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/nomina");
  return { ok: true };
}

export async function deleteWorker(id: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("workers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/nomina");
  return { ok: true };
}
