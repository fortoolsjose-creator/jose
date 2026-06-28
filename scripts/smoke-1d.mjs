// Smoke test for 1D: tenant_submit_payment_reference RPC behavior + isolation.
import { createClient } from "@supabase/supabase-js";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const luis = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SR, { auth: { persistSession: false } });
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

await luis.auth.signInWithPassword({ email: "luis@example.com", password: "Llave1234!" });

// an unpaid payment of luis
const pay = (
  await luis.from("payments").select("id, status").neq("status", "paid").limit(1).maybeSingle()
).data;
ok("luis tiene un pago no pagado", pay ? null : new Error("ninguno"));

// mark as paid via RPC
const r1 = await luis.rpc("tenant_submit_payment_reference", {
  p_payment_id: pay.id,
  p_reference: "SMOKE-REF-123",
  p_method: "spei",
});
ok("RPC registra la clave", r1.error);

const after = (
  await luis.from("payments").select("status, tenant_reference, tenant_marked_paid_at").eq("id", pay.id).single()
).data;
ok("el estado NO cambió a 'paid'", after.status !== "paid" ? null : new Error("se marcó paid"));
ok("guardó la clave del inquilino", after.tenant_reference === "SMOKE-REF-123" ? null : new Error(String(after.tenant_reference)));
ok("registró la marca de tiempo", after.tenant_marked_paid_at ? null : new Error("sin timestamp"));

// already-paid guard
const paid = (await luis.from("payments").select("id").eq("status", "paid").limit(1).maybeSingle()).data;
if (paid) {
  const r2 = await luis.rpc("tenant_submit_payment_reference", { p_payment_id: paid.id, p_reference: "X", p_method: "spei" });
  ok("rechaza un recibo ya pagado", r2.error ? null : new Error("se permitió"));
}

// isolation: luis can't submit on maria's payment
const maria = (await admin.from("profiles").select("id").eq("email", "maria@example.com").single()).data;
const mariaLease = (await admin.from("leases").select("id").eq("tenant_profile_id", maria.id).limit(1).single()).data;
const mariaPay = (await admin.from("payments").select("id").eq("lease_id", mariaLease.id).limit(1).single()).data;
const r3 = await luis.rpc("tenant_submit_payment_reference", { p_payment_id: mariaPay.id, p_reference: "HACK", p_method: "spei" });
ok("rechaza el pago de OTRO inquilino", r3.error ? null : new Error("¡se permitió!"));

// cleanup
await admin.from("payments").update({ tenant_reference: null, tenant_marked_paid_at: null }).eq("id", pay.id);

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ 1D OK\n");
process.exit(fails ? 1 : 0);
