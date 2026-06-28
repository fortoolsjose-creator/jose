// Importa valuaciones (valor de compra + precio sugerido) para plusvalía.
// Solo las propiedades con dato LIMPIO en el Excel. Idempotente (no duplica).
// Correr: node --env-file=.env.local scripts/import-plusvalia.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const today = new Date().toISOString().slice(0, 10);

// Datos extraídos de "INMUEBLES ANALISIS DE VENTA PRECIOS SUGERIDOS.xlsx".
// compra_on: fecha aproximada de compra (editable por la asistente).
const ITEMS = [
  { prop: "Campeche", compra: 1330000, sugerido: 2000000, compra_on: "2022-01-01" },
  { prop: "Medellín", compra: 502000, sugerido: 1525857, compra_on: "2022-01-01" },
];

for (const it of ITEMS) {
  const { data: p } = await a
    .from("properties")
    .select("id, org_id")
    .eq("name", it.prop)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) {
    console.log(`  ✗ No encontré la propiedad "${it.prop}"`);
    continue;
  }
  const { data: existing } = await a
    .from("property_valuations")
    .select("id")
    .eq("property_id", p.id);
  if (existing && existing.length > 0) {
    console.log(`  • ${it.prop}: ya tiene valuaciones, omito (no duplico).`);
    continue;
  }
  const { error } = await a.from("property_valuations").insert([
    { org_id: p.org_id, property_id: p.id, valued_on: it.compra_on, market_value: it.compra, source: "Valor de compra (Excel)" },
    { org_id: p.org_id, property_id: p.id, valued_on: today, market_value: it.sugerido, source: "Precio de venta sugerido (Excel)" },
  ]);
  if (error) {
    console.log(`  ✗ ${it.prop}: ${error.message}`);
    continue;
  }
  await a.from("properties").update({ market_value: it.sugerido }).eq("id", p.id);
  const plus = it.sugerido - it.compra;
  const pct = Math.round((plus / it.compra) * 100);
  console.log(`  ✓ ${it.prop}: compra $${it.compra.toLocaleString()} → hoy $${it.sugerido.toLocaleString()}  (plusvalía +${pct}%)`);
}
console.log("\nListo.");
