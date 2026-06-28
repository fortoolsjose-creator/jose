import { createClient } from "@supabase/supabase-js";
const owner = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
await owner.auth.signInWithPassword({ email: "ana@propiedadesgarcia.mx", password: "Llave1234!" });
const me = (await owner.auth.getUser()).data.user;
const prof = (await owner.from("profiles").select("org_id").eq("id", me.id).single()).data;

const count = async (t) =>
  (await owner.from(t).select("id", { count: "exact", head: true }).is("deleted_at", null)).count;

console.log("Como admin (ana) veo:");
console.log("  propiedades:", await count("properties"));
console.log("  unidades:   ", await count("units"));
console.log("  contratos:  ", await count("leases"));
console.log("  inquilinos: ", await count("profiles"));

// pre-generate June rent rows (what the app does on /panel)
const leases = (
  await owner.from("leases").select("id, rent_amount, payment_day").eq("status", "active").is("deleted_at", null)
).data;
const period = "2026-06-01";
const rows = leases.map((l) => ({
  org_id: prof.org_id,
  lease_id: l.id,
  period_month: period,
  amount_due: l.rent_amount,
  due_date: `2026-06-${String(Math.min(l.payment_day, 28)).padStart(2, "0")}`,
  status: "pending",
}));
await owner.from("payments").upsert(rows, { onConflict: "lease_id,period_month", ignoreDuplicates: true });

const pays = (
  await owner.from("payments").select("amount_due, amount_paid, period_month").is("deleted_at", null)
).data;
const tm = (pays ?? []).filter((p) => p.period_month === period);
const rentRoll = leases.reduce((s, l) => s + Number(l.rent_amount), 0);
const pendiente = tm.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
console.log(`\n  Renta mensual total (suma de contratos): $${rentRoll.toLocaleString("es-MX")}`);
console.log(`  Cobros de junio generados: ${tm.length}  ·  pendiente: $${pendiente.toLocaleString("es-MX")}\n`);
