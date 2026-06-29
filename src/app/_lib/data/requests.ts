import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type {
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
  RequestEvent,
} from "@/app/_lib/types";

export type RequestListItem = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  mtype: MaintenanceType;
  created_at: string;
  unit: { label: string; property: { name: string } | null } | null;
  created_by_profile: { full_name: string | null; email: string | null } | null;
};

const PRIORITY_WEIGHT: Record<MaintenancePriority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

const OPEN_FIRST: Record<MaintenanceStatus, number> = {
  recibido: 0,
  en_proceso: 1,
  resuelto: 2,
  cancelado: 3,
};

/** Admin inbox: all org requests, sorted by open-status, then priority, then age. */
export async function listRequestsAdmin(opts: {
  status?: string;
}): Promise<RequestListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("maintenance_requests")
    .select(
      "id, title, category, priority, status, mtype, created_at, unit:units(label, property:properties(name)), created_by_profile:profiles!maintenance_requests_created_by_fkey(full_name, email)",
    )
    .is("deleted_at", null);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  const rows = (data ?? []) as unknown as RequestListItem[];
  return rows.sort(
    (a, b) =>
      OPEN_FIRST[a.status] - OPEN_FIRST[b.status] ||
      PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
      (a.created_at < b.created_at ? -1 : 1),
  );
}

export type TenantRequestItem = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  created_at: string;
  unit: { label: string; property: { name: string } | null } | null;
};

/** Tenant: my own requests, newest first (RLS scopes to me). */
export async function listMyRequests(): Promise<TenantRequestItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_requests")
    .select(
      "id, title, category, status, created_at, unit:units(label, property:properties(name))",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as TenantRequestItem[];
}

export type RequestEventRow = RequestEvent & {
  actor: { full_name: string | null; email: string | null } | null;
  photo_signed_url?: string | null;
};

export async function getRequest(id: string): Promise<{
  request:
    | (MaintenanceRequest & {
        unit: { label: string; property: { name: string } | null } | null;
        created_by_profile: { full_name: string | null; email: string | null } | null;
      })
    | null;
  events: RequestEventRow[];
}> {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select(
      "*, unit:units(label, property:properties(name)), created_by_profile:profiles!maintenance_requests_created_by_fkey(full_name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const { data: events } = await supabase
    .from("request_events")
    .select("*, actor:profiles(full_name, email)")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const rows = (events ?? []) as unknown as RequestEventRow[];
  // Las fotos viven en el bucket privado "documents": firmamos una URL temporal
  // para poder mostrarlas. RLS deja al arrendatario ver las suyas y al staff las de su org.
  await Promise.all(
    rows
      .filter((e) => e.type === "photo" && e.photo_url)
      .map(async (e) => {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(e.photo_url as string, 600);
        e.photo_signed_url = data?.signedUrl ?? null;
      }),
  );

  return {
    request: (request as never) ?? null,
    events: rows,
  };
}
