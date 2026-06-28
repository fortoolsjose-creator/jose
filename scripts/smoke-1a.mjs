// Quick smoke test of the 1A write paths under RLS (as the owner). Cleans up after.
import { createClient } from "@supabase/supabase-js";
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message}` : ""}`);
  if (e) fails++;
};

await c.auth.signInWithPassword({
  email: "ana@propiedadesgarcia.mx",
  password: "Llave1234!",
});
const me = (await c.auth.getUser()).data.user;
const prof = (await c.from("profiles").select("org_id").eq("id", me.id).single())
  .data;

const { data: prop, error: e1 } = await c
  .from("properties")
  .insert({ org_id: prof.org_id, name: "__SMOKE__", type: "apartment", colonia: "Centro" })
  .select()
  .single();
ok("owner inserta propiedad", e1);

const { error: e2 } = await c.from("units").insert({
  org_id: prof.org_id,
  property_id: prop.id,
  label: "T-1",
  rent_amount: 1000,
  deposit_amount: 1000,
  status: "vacant",
});
ok("owner inserta unidad", e2);

const { error: e3 } = await c
  .from("properties")
  .update({ name: "__SMOKE2__" })
  .eq("id", prop.id);
ok("owner edita propiedad", e3);

// cleanup (soft delete)
await c.from("units").update({ deleted_at: new Date().toISOString() }).eq("property_id", prop.id);
const { error: e4 } = await c
  .from("properties")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", prop.id);
ok("cleanup (soft delete)", e4);

console.log(fails === 0 ? "\n✅ 1A write paths OK\n" : `\n❌ ${fails} fallo(s)\n`);
process.exit(fails ? 1 : 0);
