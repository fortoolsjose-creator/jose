import { createClient } from "@supabase/supabase-js";
const owner = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
await owner.auth.signInWithPassword({ email: "ana@propiedadesgarcia.mx", password: "Llave1234!" });

const DAY = 86_400_000;
const dov = (due) => (due ? Math.max(0, Math.floor((Date.now() - new Date(due + "T00:00:00").getTime()) / DAY)) : 0);
const period = "2026-06-01";

const { data } = await owner
  .from("payments")
  .select("lease_id, amount_due, amount_paid, status, period_month, due_date")
  .is("deleted_at", null);
const rows = data ?? [];
const tm = rows.filter((r) => r.period_month === period);
const cobrado = tm.reduce((s, r) => s + Number(r.amount_paid), 0);
const totalMes = tm.reduce((s, r) => s + Number(r.amount_due), 0);
const porCobrar = tm.reduce((s, r) => s + Math.max(0, Number(r.amount_due) - Number(r.amount_paid)), 0);
const overdue = rows.filter((r) => {
  const bal = Number(r.amount_due) - Number(r.amount_paid);
  return bal > 0 && (r.status === "overdue" || (r.due_date && r.status !== "paid" && dov(r.due_date) > 0));
});
const vencido = overdue.reduce((s, r) => s + (Number(r.amount_due) - Number(r.amount_paid)), 0);

const mx = (n) => "$" + Math.round(n).toLocaleString("es-MX");
console.log("Resumen de cobranza (datos reales):");
console.log("  pagos en sistema:", rows.length);
console.log("  cobrado (jun):   ", mx(cobrado), `(${totalMes ? Math.round((cobrado / totalMes) * 100) : 0}%)`);
console.log("  por cobrar (jun):", mx(porCobrar));
console.log("  vencido (total): ", mx(vencido), "·", new Set(overdue.map((r) => r.lease_id)).size, "deudores");

const lease = (
  await owner.from("leases").select("id, rent_amount, payment_day, tenant:profiles(full_name)").eq("status", "active").order("rent_amount", { ascending: false }).limit(1).maybeSingle()
).data;
const lp = (await owner.from("payments").select("amount_due, amount_paid, due_date").eq("lease_id", lease.id).is("deleted_at", null)).data;
const saldo = (lp ?? []).reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
const dias = Math.max(0, ...(lp ?? []).map((p) => dov(p.due_date)), 0);
console.log("\nEjemplo de estado de cuenta:");
console.log(`  ${lease.tenant?.full_name ?? "?"} — renta ${mx(lease.rent_amount)} — saldo ${mx(saldo)} — ${dias} días de atraso — recargo sug. ${mx(saldo * 0.1)}`);
