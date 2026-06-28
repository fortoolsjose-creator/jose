// Smoke test for Phase 2 (acquisition): public listing access, anon application
// security, and convert-to-tenant. Cleans up after.
import { createClient } from "@supabase/supabase-js";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const owner = createClient(URL, ANON, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

await owner.auth.signInWithPassword({ email: "ana@propiedadesgarcia.mx", password: "Llave1234!" });
const org = (await admin.from("organizations").select("id").eq("name", "Propiedades García").single()).data;
const prop = (await admin.from("properties").select("id").eq("org_id", org.id).is("deleted_at", null).limit(1).single()).data;
const unit = (await admin.from("units").insert({ org_id: org.id, property_id: prop.id, label: "__SMOKE2_UNIT__", rent_amount: 9000, deposit_amount: 9000, status: "vacant" }).select().single()).data;
const draft = (await admin.from("listings").insert({ org_id: org.id, unit_id: unit.id, title: "__DRAFT__", rent_amount: 9000, status: "draft", public_slug: "smoke-draft-xyz", photos: [] }).select().single()).data;
const pub = (await admin.from("listings").insert({ org_id: org.id, unit_id: unit.id, title: "__PUB__", rent_amount: 9000, status: "published", public_slug: "smoke-pub-xyz", photos: [] }).select().single()).data;

// --- anonymous access boundary ---
const r1 = await anon.from("listings").select("id, title").eq("public_slug", "smoke-pub-xyz").maybeSingle();
ok("anon lee el listing publicado", r1.error || !r1.data ? new Error("no lo vio") : null);
const r2 = await anon.from("listings").select("id").eq("public_slug", "smoke-draft-xyz");
ok("anon NO ve un listing borrador", (r2.data?.length ?? 0) === 0 ? null : new Error("vio el borrador"));
const r3 = await anon.from("units").select("id").eq("id", unit.id);
ok("anon NO lee la tabla units", (r3.data?.length ?? 0) === 0 ? null : new Error("leyó units"));

// --- anonymous application insert ---
const r4 = await anon.from("applications").insert({ org_id: org.id, listing_id: pub.id, applicant_name: "Anon Tester", applicant_email: "anon2@example.com", guarantee_type: "aval", status: "recibida" });
ok("anon envía solicitud (publicado + org correcto)", r4.error);
const r5 = await anon.from("applications").insert({ org_id: "00000000-0000-0000-0000-000000000000", listing_id: pub.id, applicant_name: "Hacker", applicant_email: "h@example.com", guarantee_type: "aval", status: "recibida" });
ok("anon NO puede falsificar org_id", r5.error ? null : new Error("permitió spoof"));
const r6 = await anon.from("applications").insert({ org_id: org.id, listing_id: draft.id, applicant_name: "X", applicant_email: "x@example.com", guarantee_type: "aval", status: "recibida" });
ok("anon NO puede solicitar a un borrador", r6.error ? null : new Error("permitió borrador"));
const r7 = await anon.from("applications").select("id");
ok("anon NO lee solicitudes", (r7.data?.length ?? 0) === 0 ? null : new Error("leyó solicitudes"));

// --- admin sees it ---
const inbox = await owner.from("applications").select("id").eq("listing_id", pub.id);
ok("admin ve la solicitud", inbox.error || (inbox.data?.length ?? 0) < 1 ? new Error("no la vio") : null);

// --- convert to tenant (mirror convertToTenant) ---
const email = "anon2@example.com";
const cu = await admin.auth.admin.createUser({ email, password: "Llave-123456", email_confirm: true, user_metadata: { full_name: "Anon Tester" } });
ok("convertir: crea inquilino", cu.error);
const tid = cu.data.user.id;
await admin.from("profiles").insert({ id: tid, org_id: org.id, role: "tenant", full_name: "Anon Tester", email });
const lease = await admin.from("leases").insert({ org_id: org.id, unit_id: unit.id, tenant_profile_id: tid, rent_amount: 9000, deposit_amount: 9000, payment_day: 1, guarantee_type: "aval", status: "pending" }).select().single();
ok("convertir: crea contrato borrador (pending)", lease.error);
await admin.from("applications").update({ status: "aprobada" }).eq("listing_id", pub.id);
await admin.from("listings").update({ status: "filled" }).eq("id", pub.id);
const t = createClient(URL, ANON, { auth: { persistSession: false } });
await t.auth.signInWithPassword({ email, password: "Llave-123456" });
const tl = await t.from("leases").select("id").is("deleted_at", null);
ok("el nuevo inquilino ve su contrato borrador (=1)", tl.data?.length === 1 ? null : new Error(`vio ${tl.data?.length}`));

// cleanup
await admin.from("leases").delete().eq("id", lease.data.id);
await admin.from("profiles").delete().eq("id", tid);
await admin.auth.admin.deleteUser(tid);
await admin.from("applications").delete().eq("listing_id", pub.id);
await admin.from("listings").delete().in("id", [draft.id, pub.id]);
await admin.from("units").delete().eq("id", unit.id);

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ Fase 2 OK\n");
process.exit(fails ? 1 : 0);
