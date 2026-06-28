import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import type { Lease, Payment, LeaseRenewal } from "@/app/_lib/types";

export type TenantLease = Lease & {
  unit: {
    label: string;
    bedrooms: number | null;
    bathrooms: number | null;
    property: {
      name: string;
      street: string | null;
      ext_number: string | null;
      int_number: string | null;
      colonia: string | null;
      municipio: string | null;
      cp: string | null;
      clabe: string | null;
      banco: string | null;
      titular: string | null;
    } | null;
  } | null;
};

/** The signed-in tenant's most recent lease (RLS scopes to them). */
export async function getTenantLease(): Promise<TenantLease | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leases")
    .select(
      "*, unit:units(label, bedrooms, bathrooms, property:properties(name, street, ext_number, int_number, colonia, municipio, cp, clabe, banco, titular))",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as TenantLease) ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Make sure the tenant's OWN active lease has a current-month payment row, and
 * recompute its overdue state. Uses the admin client (scoped to this one lease)
 * so the tenant always sees an up-to-date "Mi renta" even before staff opens a
 * money screen.
 */
export async function ensureTenantCurrentPayment(): Promise<void> {
  const profile = await getProfile();
  if (!profile || profile.role !== "tenant") return;
  const supabase = await createClient();
  const { data: lease } = await supabase
    .from("leases")
    .select("id, org_id, rent_amount, payment_day")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lease) return;

  const admin = createAdminClient();
  const now = new Date();
  const period = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  await admin.from("payments").upsert(
    [
      {
        org_id: lease.org_id,
        lease_id: lease.id,
        period_month: period,
        amount_due: lease.rent_amount,
        due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(Math.min(lease.payment_day, 28))}`,
        status: "pending",
      },
    ],
    { onConflict: "lease_id,period_month", ignoreDuplicates: true },
  );

  const today = now.toISOString().slice(0, 10);
  await admin
    .from("payments")
    .update({ status: "overdue" })
    .eq("lease_id", lease.id)
    .eq("status", "pending")
    .eq("amount_paid", 0)
    .lt("due_date", today);
}

/** The tenant's payments, newest period first. */
export async function getTenantPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .is("deleted_at", null)
    .order("period_month", { ascending: false });
  return (data ?? []) as Payment[];
}

/** Historial de renovaciones/incrementos del contrato del inquilino (RLS scopes). */
export async function getTenantRenewals(): Promise<LeaseRenewal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lease_renewals")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as LeaseRenewal[];
}

export type TenantAccount = {
  saldo: number;
  pendientes: { period: string; saldo: number; due_date: string | null }[];
  streak: number;
  pagados: number;
};

/**
 * Resumen de cuenta del inquilino derivado de sus pagos (sin consultas extra):
 * saldo total, meses pendientes desglosados, y racha de meses al corriente.
 * Espera `payments` ordenados del más reciente al más antiguo.
 */
export function tenantAccountSummary(payments: Payment[]): TenantAccount {
  const bal = (p: Payment) => Number(p.amount_due) - Number(p.amount_paid ?? 0);
  const saldo = payments.reduce((s, p) => s + Math.max(0, bal(p)), 0);
  const pendientes = payments
    .filter((p) => bal(p) > 0)
    .map((p) => ({ period: p.period_month, saldo: bal(p), due_date: p.due_date }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
  let streak = 0;
  for (const p of payments) {
    if (bal(p) <= 0) streak += 1;
    else break;
  }
  const pagados = payments.filter((p) => bal(p) <= 0).length;
  return { saldo, pendientes, streak, pagados };
}
