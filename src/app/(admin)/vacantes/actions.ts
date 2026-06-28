"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import { listingSchema, type ListingInput } from "@/app/_lib/schemas";
import type { ListingStatus } from "@/app/_lib/types";

export type Result = { ok?: true; error?: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function requireStaff() {
  const p = await getProfile();
  return !p || p.role === "tenant" ? null : p;
}

export async function createListing(
  input: ListingInput,
  photos: string[] = [],
): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();

  // La RLS de units limita a la org del staff: un id ajeno devuelve null.
  const { data: unit } = await supabase
    .from("units")
    .select("id")
    .eq("id", d.unit_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!unit) return { error: "Unidad no válida." };

  const slug = `${slugify(d.title) || "vacante"}-${Math.random().toString(36).slice(2, 7)}`;

  const { error } = await supabase.from("listings").insert({
    org_id: profile.org_id,
    unit_id: d.unit_id,
    title: d.title,
    description: d.description?.trim() || null,
    rent_amount: d.rent_amount,
    available_from: d.available_from || null,
    requirements: d.requirements?.trim() || null,
    photos: photos.slice(0, 12),
    status: "draft",
    public_slug: slug,
  });
  if (error) return { error: "No se pudo crear la vacante." };
  revalidatePath("/vacantes");
  return { ok: true };
}

export async function setListingStatus(
  id: string,
  status: ListingStatus,
): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status }).eq("id", id);
  if (error) return { error: "No se pudo actualizar." };
  revalidatePath("/vacantes");
  return { ok: true };
}

export async function deleteListing(id: string): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/vacantes");
  return { ok: true };
}
