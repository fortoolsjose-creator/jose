// Asigna una contraseña distinta a cada usuario admin.
// Correr: node --env-file=.env.local scripts/set-passwords.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CREDS = [
  { email: "magaly@app.metrosredondos.com", pass: "Magaly-MR-2407" },
  { email: "adriana@app.metrosredondos.com", pass: "Adri-MR-9183" },
  { email: "genaro@app.metrosredondos.com", pass: "Genaro-MR-5640" },
];

const { data: list } = await a.auth.admin.listUsers({ perPage: 1000 });
for (const c of CREDS) {
  const found = (list?.users ?? []).find((x) => x.email?.toLowerCase() === c.email);
  if (!found) {
    console.log(`  ✗ ${c.email}: no existe`);
    continue;
  }
  const { error } = await a.auth.admin.updateUserById(found.id, { password: c.pass });
  if (error) {
    console.log(`  ✗ ${c.email}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${c.email.padEnd(34)} → ${c.pass}`);
}
console.log("\nListo. Cada quien puede cambiar su contraseña después.");
