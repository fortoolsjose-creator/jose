// Le pone una contraseña conocida a UN inquilino para poder mostrar su vista.
// Correr: node --env-file=.env.local scripts/reset-tenant-pw.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL = "valentina@pendiente.example.com";
const NEWPW = "Inquilino1234!";

const { data, error } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) { console.log("Error:", error.message); process.exit(1); }
const u = data.users.find((x) => x.email === EMAIL);
if (!u) { console.log("No encontré a", EMAIL); process.exit(1); }

const { error: e2 } = await a.auth.admin.updateUserById(u.id, { password: NEWPW });
if (e2) { console.log("No pude cambiar la contraseña:", e2.message); process.exit(1); }
console.log(`OK ✅  Login de inquilino:\n  Correo: ${EMAIL}\n  Contraseña: ${NEWPW}`);
