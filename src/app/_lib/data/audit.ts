import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

export type AuditEntry = {
  id: number;
  actor_id: string | null;
  table_name: string;
  row_id: string | null;
  action: string;
  diff: Record<string, { antes?: unknown; despues?: unknown }> | Record<string, unknown> | null;
  created_at: string;
  actorName: string | null;
};

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  payments: "Cobro",
  expenses: "Gasto",
  leases: "Contrato",
  maintenance_fees: "Cuota",
};

/** Últimos cambios registrados (UPDATE/DELETE) en las tablas de dinero. */
export async function listAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select(
      "id, actor_id, table_name, row_id, action, diff, created_at, actor:profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => {
    const row = r as unknown as AuditEntry & {
      actor?: { full_name: string | null; email: string | null } | null;
    };
    return { ...row, actorName: row.actor?.full_name ?? row.actor?.email ?? null };
  });
}
