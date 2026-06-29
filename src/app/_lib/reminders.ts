import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import { notify } from "@/app/_lib/notifications";
import { formatMonth, formatDate } from "@/app/_lib/format";

/**
 * Automated, sequenced reminder sweep meant to run once per day from a cron
 * (no user session) — uses the admin client. Each payment gets at most one
 * message per cadence because we match the EXACT day offset to the due date:
 *   T-3 (pre) · día de vencimiento (due) · T+1 (overdue) · T+7 (overdue7).
 * A daily cron therefore never double-sends, so no dedupe table is needed yet.
 */
const DAY = 86_400_000;
const CADENCE: Record<number, string> = { 3: "pre", 0: "due", [-1]: "overdue", [-7]: "overdue7" };

export async function runReminderSweep(): Promise<{ sent: number; scanned: number }> {
  const admin = createAdminClient();
  const todayUTC = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();

  const { data } = await admin
    .from("payments")
    .select(
      "id, period_month, amount_due, amount_paid, due_date, status, lease:leases(tenant:profiles(email))",
    )
    .is("deleted_at", null)
    .in("status", ["pending", "overdue"]);

  const rows = data ?? [];
  let sent = 0;
  for (const p of rows) {
    const bal = Number(p.amount_due) - Number(p.amount_paid ?? 0);
    if (bal <= 0 || !p.due_date) continue;
    const diff = Math.round((new Date(p.due_date + "T00:00:00Z").getTime() - todayUTC) / DAY);
    const cadence = CADENCE[diff];
    if (!cadence) continue;
    const email = (p as unknown as { lease?: { tenant?: { email: string | null } } }).lease
      ?.tenant?.email;
    if (!email) continue;
    await notify({
      to: email,
      template: "payment_reminder",
      data: { period: formatMonth(p.period_month), amount: bal, dueDate: formatDate(p.due_date), cadence },
    });
    sent += 1;
  }
  return { sent, scanned: rows.length };
}

/**
 * Recordatorios de RENOVACIÓN de contrato: 3 meses / 1 mes / 15 días antes de
 * que venza (leases.end_date). Avisa al arrendatario y al dueño/staff de la org.
 * Igual que arriba, coincidencia por día exacto => sin duplicados en un cron diario.
 */
const RENEWAL_CADENCE: Record<number, string> = { 90: "90d", 30: "30d", 15: "15d" };

export async function runRenewalReminderSweep(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const todayUTC = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();

  const { data: leases } = await admin
    .from("leases")
    .select(
      "id, end_date, org_id, tenant:profiles(email, full_name), unit:units(label, property:properties(name))",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .not("end_date", "is", null);

  const due = (leases ?? [])
    .map((l) => {
      const diff = Math.round(
        (new Date((l.end_date as string) + "T00:00:00Z").getTime() - todayUTC) / DAY,
      );
      return { l, cadence: RENEWAL_CADENCE[diff] };
    })
    .filter((x) => x.cadence);
  if (due.length === 0) return { sent: 0 };

  // Correos de dueños/staff por org (una sola consulta).
  const orgIds = [...new Set(due.map((x) => x.l.org_id))];
  const { data: staff } = await admin
    .from("profiles")
    .select("org_id, email")
    .in("org_id", orgIds)
    .in("role", ["owner", "staff"]);
  const staffByOrg = new Map<string, string[]>();
  for (const s of staff ?? []) {
    if (!s.email) continue;
    const arr = staffByOrg.get(s.org_id) ?? [];
    arr.push(s.email);
    staffByOrg.set(s.org_id, arr);
  }

  let sent = 0;
  for (const { l, cadence } of due) {
    const lease = l as unknown as {
      tenant?: { email: string | null; full_name: string | null };
      unit?: { label: string; property?: { name: string } | null } | null;
    };
    const unit = [lease.unit?.property?.name, lease.unit?.label].filter(Boolean).join(" · ");
    const base = { endDate: formatDate(l.end_date as string), unit, cadence };

    if (lease.tenant?.email) {
      await notify({
        to: lease.tenant.email,
        template: "renewal_reminder",
        data: { ...base, audience: "tenant" },
      });
      sent += 1;
    }
    for (const email of staffByOrg.get(l.org_id) ?? []) {
      await notify({
        to: email,
        template: "renewal_reminder",
        data: { ...base, audience: "staff", tenant: lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario" },
      });
      sent += 1;
    }
  }
  return { sent };
}

/**
 * Recordatorios de vencimiento de GARANTÍA/PÓLIZA jurídica: 30 y 15 días antes
 * de leases.poliza_vigencia. Avisa solo al dueño/staff (es gestión interna).
 */
const POLIZA_CADENCE: Record<number, boolean> = { 30: true, 15: true };

export async function runPolizaReminderSweep(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const todayUTC = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();

  const { data: leases } = await admin
    .from("leases")
    .select(
      "id, poliza_vigencia, org_id, tenant:profiles(full_name, email), unit:units(label, property:properties(name))",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .not("poliza_vigencia", "is", null);

  const due = (leases ?? []).filter((l) => {
    const diff = Math.round(
      (new Date((l.poliza_vigencia as string) + "T00:00:00Z").getTime() - todayUTC) / DAY,
    );
    return POLIZA_CADENCE[diff];
  });
  if (due.length === 0) return { sent: 0 };

  const orgIds = [...new Set(due.map((x) => x.org_id))];
  const { data: staff } = await admin
    .from("profiles")
    .select("org_id, email")
    .in("org_id", orgIds)
    .in("role", ["owner", "staff"]);
  const staffByOrg = new Map<string, string[]>();
  for (const s of staff ?? []) {
    if (!s.email) continue;
    const arr = staffByOrg.get(s.org_id) ?? [];
    arr.push(s.email);
    staffByOrg.set(s.org_id, arr);
  }

  let sent = 0;
  for (const l of due) {
    const lease = l as unknown as {
      tenant?: { full_name: string | null; email: string | null };
      unit?: { label: string; property?: { name: string } | null } | null;
    };
    const unit = [lease.unit?.property?.name, lease.unit?.label].filter(Boolean).join(" · ");
    for (const email of staffByOrg.get(l.org_id) ?? []) {
      await notify({
        to: email,
        template: "poliza_reminder",
        data: {
          unit,
          tenant: lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario",
          fecha: formatDate(l.poliza_vigencia as string),
        },
      });
      sent += 1;
    }
  }
  return { sent };
}

/**
 * Sends a friendly reminder for each pending/overdue payment due within ~3 days.
 * Phase 1 sends email (mock by default). Wire this to a scheduler (Supabase
 * scheduled function / Vercel cron) to make it fully automated; it can also be
 * triggered manually from the Cobros screen.
 */
export async function sendPaymentReminders(): Promise<{ sent: number }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { sent: 0 };

  const supabase = await createClient();
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("payments")
    .select(
      "id, period_month, amount_due, due_date, status, lease:leases(tenant:profiles(email))",
    )
    .is("deleted_at", null)
    .in("status", ["pending", "overdue"])
    .lte("due_date", soon);

  let sent = 0;
  for (const p of data ?? []) {
    const email = (
      p as unknown as { lease?: { tenant?: { email: string | null } } }
    ).lease?.tenant?.email;
    if (!email) continue;
    await notify({
      to: email,
      template: "payment_reminder",
      data: {
        period: formatMonth(p.period_month),
        amount: p.amount_due,
        dueDate: p.due_date ? formatDate(p.due_date) : "pronto",
      },
    });
    sent += 1;
  }
  return { sent };
}
