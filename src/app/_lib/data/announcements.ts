import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Announcement } from "@/app/_lib/types";

export type AnnouncementRow = Announcement & { propertyName: string | null };

/** Todos los avisos de la org (vista admin). */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("*, property:properties(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((a) => {
    const row = a as unknown as Announcement & { property?: { name: string } | null };
    return { ...row, propertyName: row.property?.name ?? null };
  });
}

/** Avisos vigentes para el inquilino (RLS lo limita a su org). */
export async function listActiveAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .is("deleted_at", null)
    .or(`until.is.null,until.gte.${today}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Announcement[];
}
