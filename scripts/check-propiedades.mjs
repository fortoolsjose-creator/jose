// Solo lectura: revisa por qué Propiedades muestra (o no) vigencia/depósito.
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: leases } = await a
  .from("leases")
  .select("id, status, unit_id, start_date, end_date, deposit_paid")
  .is("deleted_at", null);

const byStatus = {};
for (const l of leases ?? []) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
console.log("Contratos por estado:", JSON.stringify(byStatus));
console.log("Contratos con fecha de fin (vigencia):", (leases ?? []).filter((l) => l.end_date).length, "de", (leases ?? []).length);
console.log("Contratos con fecha de inicio:", (leases ?? []).filter((l) => l.start_date).length);
console.log("Contratos activos con unidad ligada:", (leases ?? []).filter((l) => l.status === "active" && l.unit_id).length);

const activeByUnit = new Map();
for (const l of leases ?? []) if (l.status === "active" && l.unit_id) activeByUnit.set(l.unit_id, l);

const { data: props } = await a.from("properties").select("id, name").is("deleted_at", null).order("name");
console.log("\nPor edificio (unidades / con contrato activo):");
for (const p of props ?? []) {
  const { data: units } = await a.from("units").select("id").eq("property_id", p.id).is("deleted_at", null);
  const withActive = (units ?? []).filter((u) => activeByUnit.has(u.id)).length;
  console.log(`  ${p.name}: ${(units ?? []).length} unidades, ${withActive} con contrato activo`);
}
