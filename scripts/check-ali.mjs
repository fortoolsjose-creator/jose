// Solo lectura: por qué una unidad sale "sin contrato activo".
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Busca unidades cuya etiqueta contenga "ALI" o que pertenezcan a Alisos.
const { data: units } = await a
  .from("units")
  .select("id, label, rent_amount, status, use_type, deleted_at, property:properties(name)")
  .or("label.ilike.%ali%");

console.log("Unidades que coinciden con 'ali':");
for (const u of units ?? []) {
  console.log(`  - ${u.property?.name} / ${u.label}  renta:${u.rent_amount}  estado:${u.status}  uso:${u.use_type}  ${u.deleted_at ? "(BORRADA)" : ""}  id:${u.id}`);
  const { data: leases } = await a
    .from("leases")
    .select("id, status, rent_amount, tenant_profile_id, start_date, end_date, deleted_at, tenant:profiles(full_name, email)")
    .eq("unit_id", u.id);
  if (!leases || leases.length === 0) {
    console.log("      -> NO tiene NINGÚN contrato ligado.");
  } else {
    for (const l of leases) {
      console.log(`      -> contrato estado:${l.status} renta:${l.rent_amount} inquilino:${l.tenant?.full_name ?? l.tenant?.email ?? "—"} ${l.deleted_at ? "(BORRADO)" : ""}`);
    }
  }
}

// También: contratos activos cuya unidad sea de Alisos
const { data: alisos } = await a.from("properties").select("id, name").ilike("name", "%alisos%").maybeSingle();
if (alisos) {
  const { data: au } = await a.from("units").select("id, label").eq("property_id", alisos.id).is("deleted_at", null);
  console.log(`\nAlisos tiene ${au?.length ?? 0} unidad(es): ${(au ?? []).map((x) => x.label).join(", ")}`);
}
