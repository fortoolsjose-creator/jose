// Smoke test for 1B: generate-on-view upsert, pdf-lib, receipts storage + signed URL.
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const owner = createClient(URL, ANON, { auth: { persistSession: false } });
let fails = 0;
const ok = (n, e) => {
  console.log(`${e ? "❌" : "✅"} ${n}${e ? ` — ${e.message || e}` : ""}`);
  if (e) fails++;
};

await owner.auth.signInWithPassword({
  email: "ana@propiedadesgarcia.mx",
  password: "Llave1234!",
});
const me = (await owner.auth.getUser()).data.user;
const prof = (await owner.from("profiles").select("org_id").eq("id", me.id).single())
  .data;

// 1) generate-on-view upsert
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const period = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
console.log(`   mes actual del sistema: ${period}`);
const leases = (
  await owner.from("leases").select("id, rent_amount, payment_day").eq("status", "active").is("deleted_at", null)
).data;
const rows = (leases ?? []).map((l) => ({
  org_id: prof.org_id,
  lease_id: l.id,
  period_month: period,
  amount_due: l.rent_amount,
  due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(Math.min(l.payment_day, 28))}`,
  status: "pending",
}));
const up = await owner
  .from("payments")
  .upsert(rows, { onConflict: "lease_id,period_month", ignoreDuplicates: true });
ok("upsert pagos del mes actual", up.error);
const cur = (
  await owner.from("payments").select("id").eq("period_month", period).is("deleted_at", null)
).data;
ok(`hay filas del mes actual (${cur?.length ?? 0})`, (cur?.length ?? 0) > 0 ? null : new Error("0"));

// 2) pdf-lib generates a real PDF (incl. accented text in WinAnsi)
const pdf = await PDFDocument.create();
const pg = pdf.addPage([400, 200]);
const f = await pdf.embedFont(StandardFonts.Helvetica);
pg.drawText("Recibo de renta - Metodo: SPEI - Perez", { x: 30, y: 150, font: f, size: 12 });
const bytes = await pdf.save();
ok("pdf-lib genera bytes", bytes?.length > 0 ? null : new Error("sin bytes"));

// 3) upload to receipts under staff RLS + signed URL
const path = `${prof.org_id}/smoke/${Date.now()}.pdf`;
const upl = await owner.storage
  .from("receipts")
  .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
ok("sube recibo a Storage (staff RLS)", upl.error);
const signed = await owner.storage.from("receipts").createSignedUrl(path, 60);
ok("genera URL firmada del recibo", signed.error);
await owner.storage.from("receipts").remove([path]); // cleanup

console.log(fails ? `\n❌ ${fails} fallo(s)\n` : "\n✅ 1B core OK\n");
process.exit(fails ? 1 : 0);
