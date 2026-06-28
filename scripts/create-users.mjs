// Crea 3 usuarios admin: Magaly (staff), Adriana (owner), Genaro (owner).
// Idempotente: si el correo ya existe, le reasigna contraseña + perfil.
// Correr: node --env-file=.env.local scripts/create-users.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Encuentra la organización (la de los admin actuales).
const { data: org } = await a
  .from("profiles")
  .select("org_id")
  .in("role", ["owner", "staff"])
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
const orgId = org?.org_id;
if (!orgId) {
  console.log("❌ No encontré la organización.");
  process.exit(1);
}

// Renombra la inmobiliaria a "Metros Redondos".
const { error: oErr } = await a.from("organizations").update({ name: "Metros Redondos" }).eq("id", orgId);
console.log(oErr ? `  ✗ no se renombró la org: ${oErr.message}` : "  ✓ Organización: Metros Redondos");

const PASS = "Metros2026!";
// Correos de la PLATAFORMA (no son buzones reales; solo para entrar). Subdominio
// "app." para indicar que son de la app de Metros Redondos.
const USERS = [
  { email: "magaly@app.metrosredondos.com", full_name: "Magaly Hernández", role: "staff" },
  { email: "adriana@app.metrosredondos.com", full_name: "Adriana", role: "owner" },
  { email: "genaro@app.metrosredondos.com", full_name: "Genaro Hurtado", role: "owner" },
];

for (const u of USERS) {
  let userId;
  const { data: created, error: cErr } = await a.auth.admin.createUser({
    email: u.email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });
  if (cErr || !created?.user) {
    // ya existe: búscalo y resetea su contraseña
    const { data: list } = await a.auth.admin.listUsers({ perPage: 1000 });
    const found = (list?.users ?? []).find((x) => x.email?.toLowerCase() === u.email);
    if (!found) {
      console.log(`  ✗ ${u.email}: ${cErr?.message ?? "no se pudo crear"}`);
      continue;
    }
    userId = found.id;
    await a.auth.admin.updateUserById(userId, { password: PASS });
  } else {
    userId = created.user.id;
  }
  const { error: pErr } = await a
    .from("profiles")
    .upsert({ id: userId, org_id: orgId, role: u.role, full_name: u.full_name, email: u.email }, { onConflict: "id" });
  if (pErr) {
    console.log(`  ✗ perfil ${u.email}: ${pErr.message}`);
    continue;
  }
  console.log(`  ✓ ${u.email.padEnd(34)} ${u.role}`);
}
console.log(`\nContraseña temporal para los 3: ${PASS}  (pueden cambiarla después)`);
