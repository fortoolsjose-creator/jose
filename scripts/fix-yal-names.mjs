// Arregla el error de import: 6 contratos colgaban de UN solo perfil
// ("Grupo logistico yal (nat)" / natalia). Los separa en los 4 inquilinos reales
// del padrón (SEGUIMIENTO RENTAS). Las FECHAS de vencimiento NO se tocan (son reales).
// Correr:  node --env-file=.env.local scripts/fix-yal-names.mjs
import { createClient } from "@supabase/supabase-js";

const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: shared } = await a
  .from("profiles")
  .select("id, org_id, full_name")
  .ilike("full_name", "%yal%")
  .maybeSingle();
if (!shared) {
  console.log("No encontré el perfil YAL. Nada que hacer.");
  process.exit(0);
}
const org = shared.org_id;
console.log("Perfil compartido:", shared.id, "·", shared.full_name);

// 1) El compartido se queda como el inquilino real de Campeche 603.
await a.from("profiles").update({ full_name: "Grupo Logístico YAL" }).eq("id", shared.id);

// 2) Crear (o reusar) los 3 inquilinos reales.
async function ensureTenant(nombre, email) {
  const { data: ex } = await a
    .from("profiles")
    .select("id")
    .eq("org_id", org)
    .eq("full_name", nombre)
    .maybeSingle();
  if (ex) return ex.id;
  const { data: created, error } = await a.auth.admin.createUser({
    email,
    email_confirm: true,
    password: "Llave-" + Math.random().toString(36).slice(2, 10),
    user_metadata: { full_name: nombre },
  });
  if (error || !created?.user) {
    console.log("ERROR creando", nombre, error?.message);
    return null;
  }
  const { error: pe } = await a
    .from("profiles")
    .insert({ id: created.user.id, org_id: org, role: "tenant", full_name: nombre, email });
  if (pe) {
    console.log("ERROR perfil", nombre, pe.message);
    return null;
  }
  return created.user.id;
}
const unbat = await ensureTenant("Integración Unbat", "integracion.unbat@pendiente.example.com");
const diesel = await ensureTenant("Laboratorio Diesel", "laboratorio.diesel@pendiente.example.com");
const soforum = await ensureTenant("Soforum", "soforum@pendiente.example.com");

// 3) Reasignar cada contrato a su inquilino real (por unidad, solo activos).
async function reassign(unitRegex, pid, label) {
  if (!pid) return;
  const { data: ls } = await a
    .from("leases")
    .select("id, unit:units(label)")
    .eq("status", "active")
    .is("deleted_at", null);
  const ids = (ls || []).filter((l) => unitRegex.test(l.unit?.label || "")).map((l) => l.id);
  for (const id of ids) await a.from("leases").update({ tenant_profile_id: pid }).eq("id", id);
  console.log(`  ${label}: ${ids.length} contrato(s) reasignados`);
}
await reassign(/^COV30[123]$/i, unbat, "COV301-303 → Integración Unbat");
await reassign(/^AME0?5$/i, diesel, "AME05 → Laboratorio Diesel");
await reassign(/^REN402$/i, soforum, "REN402 → Soforum");

console.log("\n✅ LISTO. Campeche 603 quedó como Grupo Logístico YAL; los demás separados.");
