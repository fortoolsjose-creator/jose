// Confirms the NEW Supabase API keys (sb_publishable_… / sb_secret_…) work with
// the installed supabase-js. Read-only. Run: node --env-file=.env.local scripts/verify-keys.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sec = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASS = "Llave1234!";
let fails = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? `  (${detail})` : ""}`);
  if (!cond) fails++;
};

console.log("Formato de llaves:");
ok("publishable empieza con sb_publishable_", pub?.startsWith("sb_publishable_"), pub?.slice(0, 18));
ok("secret empieza con sb_secret_", sec?.startsWith("sb_secret_"), sec?.slice(0, 12));

// 1) PUBLISHABLE: login + lectura con RLS (rol authenticated)
console.log("\nLlave PUBLISHABLE (login + RLS):");
const c = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: loginErr } = await c.auth.signInWithPassword({ email: "ana@propiedadesgarcia.mx", password: PASS });
ok("login de la dueña (Ana) funciona", !loginErr, loginErr?.message);
const props = await c.from("properties").select("id, name");
ok("lee propiedades (RLS authenticated)", !props.error && props.data?.length > 0, props.error?.message ?? `${props.data?.length} props`);

// 2) SECRET: service-role (bypassa RLS) + admin auth
console.log("\nLlave SECRET (service-role + admin):");
const s = createClient(url, sec, { auth: { persistSession: false } });
const sProps = await s.from("properties").select("id");
ok("lee con service-role (bypassa RLS)", !sProps.error && sProps.data?.length > 0, sProps.error?.message ?? `${sProps.data?.length} props`);
const adminList = await s.auth.admin.listUsers({ page: 1, perPage: 1 });
ok("auth.admin funciona (crear/editar usuarios)", !adminList.error, adminList.error?.message);

console.log(`\n${fails === 0 ? "✅ LAS DOS LLAVES NUEVAS JALAN" : `❌ ${fails} fallo(s) — NO desactives la vieja todavía`}\n`);
process.exit(fails === 0 ? 0 : 1);
