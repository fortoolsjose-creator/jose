// Verifies the convertToTenant idempotency claim: the atomic status claim can
// only succeed once, so a double-click can't create duplicate leases.
import { createClient } from "@supabase/supabase-js";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

const listing = (
  await admin.from("listings").select("id, org_id").eq("public_slug", "roma-norte-2b").single()
).data;
const app = (
  await admin
    .from("applications")
    .insert({ org_id: listing.org_id, listing_id: listing.id, applicant_name: "Claim Test", applicant_email: "claim@example.com", guarantee_type: "aval", status: "recibida" })
    .select()
    .single()
).data;

const claim = () =>
  admin.from("applications").update({ status: "aprobada" }).eq("id", app.id).neq("status", "aprobada").select("id").maybeSingle();

const c1 = await claim();
ok("primer claim toma la solicitud", c1.data ? null : new Error("no tomó"));
const c2 = await claim();
ok("segundo claim NO toma (idempotente)", c2.data ? new Error("tomó dos veces") : null);

await admin.from("applications").delete().eq("id", app.id);
console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ convert idempotente OK\n");
process.exit(fails ? 1 : 0);
