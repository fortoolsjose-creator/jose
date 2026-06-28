// Smoke test for the 1A lease/tenant flow. Mirrors createLease(), then cleans up.
import { createClient } from "@supabase/supabase-js";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const owner = createClient(URL, ANON, { auth: { persistSession: false } });
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

await owner.auth.signInWithPassword({
  email: "ana@propiedadesgarcia.mx",
  password: "Llave1234!",
});

// 1) Embed query (listLeases)
const { data: leases, error: lerr } = await owner
  .from("leases")
  .select(
    "id, status, rent_amount, unit:units(label, property:properties(name)), tenant:profiles(full_name, email)",
  )
  .is("deleted_at", null);
ok("embed listLeases query", lerr);
if (leases?.length)
  console.log(
    `   ej: ${leases[0].tenant?.full_name} → ${leases[0].unit?.property?.name} ${leases[0].unit?.label}`,
  );

// 2) Invite-tenant + activate path
const org = (
  await admin.from("organizations").select("id").eq("name", "Propiedades García").single()
).data;
const prop = (
  await admin.from("properties").select("id").eq("org_id", org.id).is("deleted_at", null).limit(1).single()
).data;
const unit = (
  await admin
    .from("units")
    .insert({ org_id: org.id, property_id: prop.id, label: "__SMOKE_UNIT__", rent_amount: 5000, deposit_amount: 5000, status: "vacant" })
    .select()
    .single()
).data;

const email = `smoke_${Date.now()}@example.com`;
const TEMP = "Llave-123456";
const cu = await admin.auth.admin.createUser({
  email, password: TEMP, email_confirm: true, user_metadata: { full_name: "Smoke Tenant" },
});
ok("createUser inquilino", cu.error);
const tid = cu.data.user.id;
ok("insert profile tenant", (await admin.from("profiles").insert({ id: tid, org_id: org.id, role: "tenant", full_name: "Smoke Tenant", email })).error);
const lease = await admin
  .from("leases")
  .insert({ org_id: org.id, unit_id: unit.id, tenant_profile_id: tid, start_date: "2026-06-01", rent_amount: 5000, deposit_amount: 5000, payment_day: 5, guarantee_type: "deposito", status: "active" })
  .select()
  .single();
ok("insert lease activo", lease.error);
ok("ocupar unidad", (await admin.from("units").update({ status: "occupied" }).eq("id", unit.id)).error);

// 3) New tenant logs in and sees ONLY their lease
const tenant = createClient(URL, ANON, { auth: { persistSession: false } });
await tenant.auth.signInWithPassword({ email, password: TEMP });
const tl = await tenant.from("leases").select("id").is("deleted_at", null);
ok("inquilino nuevo ve solo su contrato (=1)", tl.data?.length === 1 ? null : new Error(`vio ${tl.data?.length}`));

// cleanup
await admin.from("leases").delete().eq("id", lease.data.id);
await admin.from("profiles").delete().eq("id", tid);
await admin.auth.admin.deleteUser(tid);
await admin.from("units").delete().eq("id", unit.id);
console.log("cleanup done");

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ 1A leases OK\n");
process.exit(fails ? 1 : 0);
