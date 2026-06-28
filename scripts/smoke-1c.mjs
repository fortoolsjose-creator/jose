// Smoke test for 1C maintenance tickets. Mirrors the server actions, then cleans up.
import { createClient } from "@supabase/supabase-js";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const luis = createClient(URL, ANON, { auth: { persistSession: false } });
const owner = createClient(URL, ANON, { auth: { persistSession: false } });
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

await luis.auth.signInWithPassword({ email: "luis@example.com", password: "Llave1234!" });
await owner.auth.signInWithPassword({ email: "ana@propiedadesgarcia.mx", password: "Llave1234!" });
const luisProf = (await luis.from("profiles").select("id, org_id").single()).data;
const ownerId = (await owner.auth.getUser()).data.user.id;
const lease = (await luis.from("leases").select("id, unit_id").eq("status", "active").maybeSingle()).data;

// 1) tenant creates a request (RLS)
const { data: req, error: reqErr } = await luis
  .from("maintenance_requests")
  .insert({ org_id: luisProf.org_id, unit_id: lease.unit_id, lease_id: lease.id, created_by: luisProf.id, title: "__SMOKE_REQ__", category: "plomeria", priority: "media", status: "recibido" })
  .select("id")
  .single();
ok("tenant crea reporte (RLS)", reqErr);

// 2) tenant must NOT be able to forge a 'created' event
const ce = await luis.from("request_events").insert({ org_id: luisProf.org_id, request_id: req.id, actor_id: luisProf.id, type: "created", body: "x" });
ok("tenant NO puede insertar evento 'created'", ce.error ? null : new Error("se permitió"));

// 3) tenant CAN add a comment
ok("tenant comenta su reporte", (await luis.from("request_events").insert({ org_id: luisProf.org_id, request_id: req.id, actor_id: luisProf.id, type: "comment", body: "Es urgente, gracias" })).error);

// 4) created event via admin (as the server action does)
await admin.from("request_events").insert({ org_id: luisProf.org_id, request_id: req.id, actor_id: luisProf.id, type: "created", body: "Reporte creado." });

// 5) admin inbox embed (explicit FK)
const inbox = await owner
  .from("maintenance_requests")
  .select("id, created_by_profile:profiles!maintenance_requests_created_by_fkey(full_name, email)")
  .eq("id", req.id);
ok("admin ve el reporte en inbox (embed fkey)", inbox.error);
ok(
  "embed trae al inquilino",
  inbox.data?.[0]?.created_by_profile?.email === "luis@example.com" ? null : new Error("embed vacío"),
);

// 6) admin changes status + logs it
ok("admin cambia estado", (await owner.from("maintenance_requests").update({ status: "en_proceso" }).eq("id", req.id)).error);
ok("admin registra status_change", (await owner.from("request_events").insert({ org_id: luisProf.org_id, request_id: req.id, actor_id: ownerId, type: "status_change", body: "Estado: En proceso" })).error);

// 7) tenant sees the update + full timeline
const tReq = (await luis.from("maintenance_requests").select("status").eq("id", req.id).single()).data;
ok("tenant ve estado actualizado", tReq?.status === "en_proceso" ? null : new Error(tReq?.status));
const tEvents = (await luis.from("request_events").select("type").eq("request_id", req.id)).data;
ok(`tenant ve la línea de tiempo (${tEvents?.length ?? 0} eventos)`, (tEvents?.length ?? 0) >= 3 ? null : new Error(String(tEvents?.length)));

// cleanup
await admin.from("maintenance_requests").delete().eq("id", req.id);

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ 1C OK\n");
process.exit(fails ? 1 : 0);
