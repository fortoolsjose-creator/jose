// Llave — seed script (Phase 0).  Run with:  npm run seed
//
// Uses the Supabase SERVICE-ROLE key (bypasses RLS) to create one organization
// with realistic CDMX data. Safe-ish: aborts if "Propiedades García" already
// exists, so you don't duplicate. Requires the schema to be applied first.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local. Corre: npm run seed",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = "Llave1234!";

async function insOne(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data;
}
async function insMany(table, rows) {
  const { data, error } = await admin.from(table).insert(rows).select();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data;
}
async function createUser(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user;
}

async function main() {
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("name", "Propiedades García")
    .maybeSingle();
  if (existing) {
    console.log('Ya existe "Propiedades García". Aborto para no duplicar datos.');
    return;
  }

  // --- Organization ---
  const org = await insOne("organizations", {
    name: "Propiedades García",
    default_clabe: "012180001234567895",
    rfc: "GAR860101AB1",
  });
  const orgId = org.id;

  // --- People (owner + tenants) ---
  const owner = await createUser("ana@propiedadesgarcia.mx", "Ana García");
  await insOne("profiles", {
    id: owner.id, org_id: orgId, role: "owner",
    full_name: "Ana García", email: "ana@propiedadesgarcia.mx", phone: "+525511112222",
  });

  const luis = await createUser("luis@example.com", "Luis Hernández");
  await insOne("profiles", {
    id: luis.id, org_id: orgId, role: "tenant",
    full_name: "Luis Hernández", email: "luis@example.com", phone: "+525533334444",
  });
  const maria = await createUser("maria@example.com", "María López");
  await insOne("profiles", {
    id: maria.id, org_id: orgId, role: "tenant",
    full_name: "María López", email: "maria@example.com", phone: "+525555556666",
  });
  const jorge = await createUser("jorge@example.com", "Jorge Ramírez");
  await insOne("profiles", {
    id: jorge.id, org_id: orgId, role: "tenant",
    full_name: "Jorge Ramírez", email: "jorge@example.com", phone: "+525577778888",
  });

  // --- Properties ---
  const roma = await insOne("properties", {
    org_id: orgId, name: "Edificio Roma 45", type: "apartment",
    street: "Calle Orizaba", ext_number: "45", colonia: "Roma Norte",
    municipio: "Cuauhtémoc", cp: "06700",
  });
  const valle = await insOne("properties", {
    org_id: orgId, name: "Casa Del Valle", type: "house",
    street: "Av. Coyoacán", ext_number: "210", colonia: "Del Valle",
    municipio: "Benito Juárez", cp: "03100",
  });
  const narvarte = await insOne("properties", {
    org_id: orgId, name: "Narvarte 88", type: "apartment",
    street: "Calle Anaxágoras", ext_number: "88", colonia: "Narvarte",
    municipio: "Benito Juárez", cp: "03020",
  });

  // --- Units (mix of occupied + vacant) ---
  const roma1a = await insOne("units", { org_id: orgId, property_id: roma.id, label: "Depto 1A", bedrooms: 2, bathrooms: 1, rent_amount: 12500, deposit_amount: 12500, status: "occupied" });
  const roma2b = await insOne("units", { org_id: orgId, property_id: roma.id, label: "Depto 2B", bedrooms: 1, bathrooms: 1, rent_amount: 11500, deposit_amount: 11500, status: "vacant" });
  const roma3c = await insOne("units", { org_id: orgId, property_id: roma.id, label: "Depto 3C", bedrooms: 2, bathrooms: 2, rent_amount: 14000, deposit_amount: 14000, status: "occupied" });
  const casa = await insOne("units", { org_id: orgId, property_id: valle.id, label: "Casa", bedrooms: 3, bathrooms: 2, rent_amount: 18000, deposit_amount: 18000, status: "occupied" });
  await insOne("units", { org_id: orgId, property_id: narvarte.id, label: "Depto 101", bedrooms: 1, bathrooms: 1, rent_amount: 9800, deposit_amount: 9800, status: "vacant" });

  // --- Leases (active) ---
  const leaseLuis = await insOne("leases", { org_id: orgId, unit_id: roma1a.id, tenant_profile_id: luis.id, start_date: "2025-09-01", end_date: "2026-08-31", rent_amount: 12500, deposit_amount: 12500, payment_day: 5, guarantee_type: "deposito", status: "active" });
  const leaseMaria = await insOne("leases", { org_id: orgId, unit_id: roma3c.id, tenant_profile_id: maria.id, start_date: "2026-01-01", end_date: "2026-12-31", rent_amount: 14000, deposit_amount: 14000, payment_day: 1, guarantee_type: "poliza_juridica", status: "active" });
  const leaseJorge = await insOne("leases", { org_id: orgId, unit_id: casa.id, tenant_profile_id: jorge.id, start_date: "2025-06-01", end_date: "2026-05-31", rent_amount: 18000, deposit_amount: 18000, payment_day: 25, guarantee_type: "aval", status: "active" });

  // --- Payments (some paid, one overdue, one pending) ---
  await insMany("payments", [
    { org_id: orgId, lease_id: leaseLuis.id, period_month: "2026-05-01", amount_due: 12500, amount_paid: 12500, due_date: "2026-05-05", paid_date: "2026-05-04", method: "spei", reference: "CLAVE-2026-0504-LUIS", status: "paid", confirmed_by: owner.id },
    { org_id: orgId, lease_id: leaseLuis.id, period_month: "2026-06-01", amount_due: 12500, amount_paid: 0, due_date: "2026-06-05", status: "overdue" },
    { org_id: orgId, lease_id: leaseMaria.id, period_month: "2026-05-01", amount_due: 14000, amount_paid: 14000, due_date: "2026-05-01", paid_date: "2026-05-01", method: "spei", reference: "CLAVE-2026-0501-MARIA", status: "paid", confirmed_by: owner.id },
    { org_id: orgId, lease_id: leaseMaria.id, period_month: "2026-06-01", amount_due: 14000, amount_paid: 14000, due_date: "2026-06-01", paid_date: "2026-06-02", method: "cash", status: "paid", confirmed_by: owner.id },
    { org_id: orgId, lease_id: leaseJorge.id, period_month: "2026-05-01", amount_due: 18000, amount_paid: 18000, due_date: "2026-05-25", paid_date: "2026-05-24", method: "spei", reference: "CLAVE-2026-0524-JORGE", status: "paid", confirmed_by: owner.id },
    { org_id: orgId, lease_id: leaseJorge.id, period_month: "2026-06-01", amount_due: 18000, amount_paid: 0, due_date: "2026-06-25", status: "pending" },
  ]);

  // --- Maintenance requests (2 open) + timeline ---
  const reqLuis = await insOne("maintenance_requests", {
    org_id: orgId, unit_id: roma1a.id, lease_id: leaseLuis.id, created_by: luis.id,
    title: "Fuga de agua en el baño", description: "Gotea la llave del lavabo y se acumula agua.",
    category: "plomeria", priority: "alta", status: "recibido",
  });
  await insOne("request_events", { org_id: orgId, request_id: reqLuis.id, actor_id: luis.id, type: "created", body: "Reporte creado por el inquilino." });

  const reqMaria = await insOne("maintenance_requests", {
    org_id: orgId, unit_id: roma3c.id, lease_id: leaseMaria.id, created_by: maria.id,
    title: "El boiler no enciende", description: "No hay agua caliente desde ayer.",
    category: "electrodomesticos", priority: "media", status: "en_proceso", assigned_to: owner.id,
  });
  await insMany("request_events", [
    { org_id: orgId, request_id: reqMaria.id, actor_id: maria.id, type: "created", body: "Reporte creado por el inquilino." },
    { org_id: orgId, request_id: reqMaria.id, actor_id: owner.id, type: "status_change", body: "En proceso: agendamos al técnico para mañana." },
  ]);

  // --- Listing (published vacancy) ---
  await insOne("listings", {
    org_id: orgId, unit_id: roma2b.id,
    title: "Depto 2B en Roma Norte, listo para estrenar",
    description: "Departamento de 1 recámara en Roma Norte, cerca de transporte y servicios.",
    rent_amount: 11500, available_from: "2026-07-01",
    requirements: "Comprobante de ingresos (3x renta), INE, aval o póliza jurídica.",
    status: "published", public_slug: "roma-norte-2b",
  });

  console.log("\n✅ Semilla lista — organización «Propiedades García».\n");
  console.log(`Contraseña para todas las cuentas de prueba: ${DEMO_PASSWORD}`);
  console.log("  Dueña (admin):  ana@propiedadesgarcia.mx");
  console.log("  Inquilino:      luis@example.com   (renta de junio VENCIDA)");
  console.log("  Inquilina:      maria@example.com  (al corriente)");
  console.log("  Inquilino:      jorge@example.com  (junio PENDIENTE)\n");
}

main().catch((e) => {
  console.error("\n❌ Error al sembrar:", e.message);
  process.exit(1);
});
