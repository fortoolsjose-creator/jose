// Loads the parsed real data into Llave. Wipes the demo seed data first (keeps the
// owner account). Re-runnable: it wipes + reloads from import-data.json.
//   node --env-file=.env.local scripts/import-load.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const data = JSON.parse(
  readFileSync(new URL("./import-data.json", import.meta.url), "utf-8"),
);

const org = (
  await admin.from("organizations").select("id").eq("name", "Propiedades García").single()
).data;
if (!org) {
  console.error('No existe la organización "Propiedades García".');
  process.exit(1);
}
const orgId = org.id;

// --- 1. Wipe demo domain data (order respects foreign keys) ---
console.log("Limpiando datos de demostración…");
for (const t of [
  "payments",
  "request_events",
  "maintenance_requests",
  "applications",
  "listings",
  "leases",
  "units",
  "properties",
]) {
  const { error } = await admin.from(t).delete().eq("org_id", orgId);
  if (error) console.error("  ", t, error.message);
}
const { data: oldTenants } = await admin
  .from("profiles")
  .select("id")
  .eq("org_id", orgId)
  .eq("role", "tenant");
for (const t of oldTenants ?? []) await admin.auth.admin.deleteUser(t.id);
console.log(`  eliminados ${oldTenants?.length ?? 0} inquilinos demo.`);

// --- 2. Load ---
const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

const tenantByName = new Map();
async function getTenant(name) {
  if (tenantByName.has(name)) return tenantByName.get(name);
  const email = `${slug(name) || "inquilino"}@pendiente.example.com`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: `Llave-${Math.floor(100000 + Math.random() * 900000)}`,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    const { data: ex } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle();
    if (ex) {
      tenantByName.set(name, ex.id);
      return ex.id;
    }
    throw new Error(`createUser ${name}: ${error.message}`);
  }
  const id = created.user.id;
  await admin.from("profiles").insert({
    id,
    org_id: orgId,
    role: "tenant",
    full_name: name,
    email,
  });
  tenantByName.set(name, id);
  return id;
}

let props = 0,
  units = 0,
  occ = 0,
  vac = 0,
  leases = 0;

for (const p of data.properties) {
  const { data: prop, error: pErr } = await admin
    .from("properties")
    .insert({ org_id: orgId, name: p.name, type: "apartment" })
    .select("id")
    .single();
  if (pErr) {
    console.error("propiedad", p.name, pErr.message);
    continue;
  }
  props++;
  for (const u of p.units) {
    const { data: unit, error: uErr } = await admin
      .from("units")
      .insert({
        org_id: orgId,
        property_id: prop.id,
        label: u.code,
        rent_amount: u.rent || 0,
        deposit_amount: 0,
        status: u.status,
      })
      .select("id")
      .single();
    if (uErr) {
      console.error("unidad", u.code, uErr.message);
      continue;
    }
    units++;
    if (u.status === "occupied") {
      occ++;
      if (u.tenant) {
        const tid = await getTenant(u.tenant);
        await admin.from("leases").insert({
          org_id: orgId,
          unit_id: unit.id,
          tenant_profile_id: tid,
          rent_amount: u.rent || 0,
          deposit_amount: 0,
          payment_day: 1,
          guarantee_type: "deposito",
          status: "active",
        });
        leases++;
      }
    } else {
      vac++;
    }
  }
  console.log(`  ${p.name}: ${p.units.length} unidades`);
}

console.log(
  `\n✅ Cargado: ${props} edificios · ${units} unidades · ${occ} ocupadas · ${vac} disponibles · ${leases} contratos · ${tenantByName.size} inquilinos.\n`,
);
