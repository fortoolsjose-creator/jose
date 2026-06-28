import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Application, Listing } from "@/app/_lib/types";

/**
 * Public listing fetch (works for anonymous visitors). Only the listing's own
 * columns are selected — anon cannot read the units/properties tables, so the
 * listing carries its own title/description/photos.
 */
export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("public_slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Listing) ?? null;
}

export type ApplicationRow = Application & {
  listing: { title: string; unit: { label: string } | null } | null;
};

/** Admin: applications inbox (RLS scopes to staff's org). */
export async function listApplications(opts: {
  status?: string;
}): Promise<ApplicationRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("applications")
    .select("*, listing:listings(title, unit:units(label))")
    .is("deleted_at", null);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as unknown as ApplicationRow[];
}

export async function getApplication(id: string): Promise<
  | (Application & {
      listing: { id: string; title: string; unit_id: string; unit: { label: string; property: { name: string } | null } | null } | null;
    })
  | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "*, listing:listings(id, title, unit_id, unit:units(label, property:properties(name)))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as never) ?? null;
}
