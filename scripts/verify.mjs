// Phase 0 verification: logs in as real users (anon key, so RLS applies) and
// checks that role access + tenant isolation behave per spec.
// Run: node --env-file=.env.local scripts/verify.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASS = "Llave1234!";
let fails = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) fails++;
}
function freshClient() {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function login(email) {
  const c = freshClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}
async function n(c, table, select = "id") {
  const { data, error } = await c.from(table).select(select);
  return error ? { n: -1, err: error.message } : { n: data.length, data };
}

console.log("\n— Dueña (Ana, owner) ve TODO lo de su organización —");
const owner = await login("ana@propiedadesgarcia.mx");
check("propiedades = 3", (await n(owner, "properties")).n === 3);
check("unidades = 5", (await n(owner, "units")).n === 5);
check("contratos = 3", (await n(owner, "leases")).n === 3);
check("pagos = 6", (await n(owner, "payments")).n === 6);
check("reportes = 2", (await n(owner, "maintenance_requests")).n === 2);
check("vacantes = 1", (await n(owner, "listings")).n === 1);
check("perfiles de la org = 4", (await n(owner, "profiles")).n === 4);
const ownerOrg = await n(owner, "organizations", "name, default_clabe, rfc");
check(
  "puede leer datos bancarios de su org (CLABE/RFC)",
  ownerOrg.n === 1 && !!ownerOrg.data[0].default_clabe,
);

console.log("\n— Inquilino (Luis) SOLO ve lo suyo —");
const luis = await login("luis@example.com");
check("ve 1 contrato (el suyo)", (await n(luis, "leases")).n === 1);
check("ve 1 unidad (la suya)", (await n(luis, "units")).n === 1);
check("ve 1 propiedad (la suya)", (await n(luis, "properties")).n === 1);
check("ve 2 pagos (los suyos)", (await n(luis, "payments")).n === 2);
check(
  "ve 1 perfil (solo el suyo, NO el de otros)",
  (await n(luis, "profiles")).n === 1,
);
check(
  "NO puede leer la tabla organizations (CLABE/RFC ocultos)",
  (await n(luis, "organizations", "default_clabe, rfc")).n === 0,
);
const luisBrand = await n(luis, "org_public_info", "name");
check(
  "SÍ ve el nombre público de su org (vista segura)",
  luisBrand.n === 1 && luisBrand.data[0].name === "Propiedades García",
);

console.log("\n— Aislamiento entre inquilinos —");
const maria = await login("maria@example.com");
const luisLeaseIds = (await n(luis, "leases", "id")).data.map((r) => r.id);
const mariaLeaseIds = (await n(maria, "leases", "id")).data.map((r) => r.id);
const overlap = luisLeaseIds.filter((id) => mariaLeaseIds.includes(id));
check(
  "los contratos de Luis y María no se cruzan",
  overlap.length === 0 && luisLeaseIds.length === 1 && mariaLeaseIds.length === 1,
);

console.log("\n— Público (sin sesión) —");
const pub = freshClient();
check("ve la vacante publicada = 1", (await n(pub, "listings")).n === 1);
check("NO puede leer solicitudes", (await n(pub, "applications")).n === 0);
check("NO puede leer contratos", (await n(pub, "leases")).n === 0);

console.log(`\n${fails === 0 ? "✅ TODO BIEN" : `❌ ${fails} fallo(s)`}\n`);
process.exit(fails === 0 ? 0 : 1);
