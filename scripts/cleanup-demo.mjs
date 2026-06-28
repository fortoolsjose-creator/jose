import { createClient } from "@supabase/supabase-js";
const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const org = (await a.from("organizations").select("id").eq("name", "Propiedades García").single()).data;

// 1) Junio: dejarlo como "pendiente" con vencimiento a fin de mes (que NO salga "vencido")
const r1 = await a
  .from("payments")
  .update({ status: "pending", due_date: "2026-06-30" })
  .eq("org_id", org.id)
  .eq("period_month", "2026-06-01")
  .is("deleted_at", null)
  .select("id");
console.log("Pagos de junio normalizados (pendiente):", r1.data?.length ?? 0, r1.error?.message ?? "");

// 2) Nombres más limpios
const renameExact = [
  ["AME (por confirmar)", "Edificio AME"],
  ["COV (por confirmar)", "Edificio COV"],
];
for (const [from, to] of renameExact) {
  const r = await a.from("properties").update({ name: to }).eq("org_id", org.id).eq("name", from).select("id");
  console.log(`  "${from}" -> "${to}":`, r.data?.length ?? 0);
}
const r3 = await a.from("properties").update({ name: "Estacionamientos COV" }).eq("org_id", org.id).ilike("name", "%estacionamientos%").select("id");
console.log(`  estacionamientos -> "Estacionamientos COV":`, r3.data?.length ?? 0);

console.log("\nListo.");
