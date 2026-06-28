import { createClient } from "@supabase/supabase-js";
const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const exp = await a.from("expenses").select("id").limit(1);
const uu = await a.from("units").select("use_type").limit(1);
const mv = await a.from("properties").select("market_value").limit(1);
const tc = await a.from("leases").select("tenant_is_company").limit(1);
console.log("tabla expenses:        ", exp.error ? "FALTA — " + exp.error.message : "OK");
console.log("units.use_type:        ", uu.error ? "FALTA" : "OK");
console.log("properties.market_value:", mv.error ? "FALTA" : "OK");
console.log("leases.tenant_is_company:", tc.error ? "FALTA" : "OK");
const applied = !exp.error && !uu.error && !mv.error && !tc.error;
console.log(applied ? "\n✅ Migración aplicada." : "\n⏳ Falta pegar el SQL.");
