import { createClient } from "@supabase/supabase-js";
const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};
const mx = (n) => "$" + Math.round(n).toLocaleString("es-MX");

ok("tabla expenses existe", (await a.from("expenses").select("id").limit(1)).error);
ok("units.use_type existe", (await a.from("units").select("use_type").limit(1)).error);

const org = (await a.from("organizations").select("id").eq("name", "Propiedades García").single()).data;

// Naves -> comercial (bodegas)
const naves = (await a.from("properties").select("id").eq("name", "Naves").eq("org_id", org.id).is("deleted_at", null).maybeSingle()).data;
let n = 0;
if (naves) {
  const r = await a.from("units").update({ use_type: "commercial" }).eq("property_id", naves.id).is("deleted_at", null).select("id");
  ok("naves marcadas comerciales", r.error);
  n = r.data?.length ?? 0;
}
console.log(`   unidades comerciales (naves): ${n}`);

// fiscal: IVA estimado sobre rentas comerciales activas
const leases = (await a.from("leases").select("rent_amount, tenant_is_company, unit:units(property_id, use_type)").eq("status", "active").is("deleted_at", null)).data ?? [];
const comercial = leases.filter((l) => l.unit?.use_type === "commercial").reduce((s, l) => s + Number(l.rent_amount), 0);
console.log(`   ingreso comercial: ${mx(comercial)}  ·  IVA estimado (16%): ${mx(comercial * 0.16)}`);

// gasto de prueba + NOI de un edificio (round-trip, se limpia)
const ame = (await a.from("properties").select("id").eq("name", "AME (por confirmar)").eq("org_id", org.id).is("deleted_at", null).maybeSingle()).data;
const period = "2026-06-01";
const ameRent = leases.filter((l) => l.unit?.property_id === ame.id).reduce((s, l) => s + Number(l.rent_amount), 0);
const e = await a.from("expenses").insert({ org_id: org.id, property_id: ame.id, category: "mantenimiento", vendor: "__SMOKE__", amount: 5000, expense_date: "2026-06-10", period_month: period }).select().single();
ok("inserta gasto de prueba (RLS)", e.error);
const gastos = ((await a.from("expenses").select("amount").eq("property_id", ame.id).eq("period_month", period).is("deleted_at", null)).data ?? []).reduce((s, r) => s + Number(r.amount), 0);
console.log(`   Edificio AME → ingreso ${mx(ameRent)} − gastos ${mx(gastos)} = NOI ${mx(ameRent - gastos)}`);
await a.from("expenses").delete().eq("id", e.data.id); // cleanup

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ Rentabilidad OK\n");
process.exit(fails ? 1 : 0);
