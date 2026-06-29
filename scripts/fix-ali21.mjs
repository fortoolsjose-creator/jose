// ALI21 (Alisos) aparece "ocupada" pero no tiene contrato activo → ponerla vacante.
// Correr: node --env-file=.env.local scripts/fix-ali21.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: unit } = await a
  .from("units")
  .select("id, label, status, property:properties(name)")
  .ilike("label", "ALI21")
  .maybeSingle();
if (!unit) {
  console.log("No encontré la unidad ALI21.");
  process.exit(0);
}
const { data: act } = await a
  .from("leases")
  .select("id")
  .eq("unit_id", unit.id)
  .eq("status", "active")
  .is("deleted_at", null);
if ((act || []).length > 0) {
  console.log("ALI21 SÍ tiene contrato activo — no la toco (revisa manualmente).");
  process.exit(0);
}
await a.from("units").update({ status: "vacant" }).eq("id", unit.id);
console.log(`✅ ${unit.property?.name || ""} ${unit.label}: de "${unit.status}" → vacante.`);
