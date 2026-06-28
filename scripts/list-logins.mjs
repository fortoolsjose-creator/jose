// Solo lectura: lista las cuentas que SÍ pueden entrar (usuarios de auth) y su rol.
// Correr: node --env-file=.env.local scripts/list-logins.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) { console.log("Error:", error.message); process.exit(1); }
const users = data.users;

const { data: profiles } = await a.from("profiles").select("id, full_name, role");
const roleById = new Map((profiles ?? []).map((p) => [p.id, p]));

console.log(`Cuentas que pueden iniciar sesión: ${users.length}\n`);
const rows = users.map((u) => {
  const p = roleById.get(u.id);
  return {
    email: u.email ?? "(sin correo)",
    rol: p?.role ?? "(sin perfil)",
    nombre: p?.full_name ?? "",
    confirmado: u.email_confirmed_at ? "sí" : "no",
  };
});
// admins primero
rows.sort((x, y) => (x.rol === "tenant" ? 1 : 0) - (y.rol === "tenant" ? 1 : 0));
for (const r of rows) {
  console.log(`  [${r.rol}] ${r.email}  confirmado:${r.confirmado}  ${r.nombre}`);
}
