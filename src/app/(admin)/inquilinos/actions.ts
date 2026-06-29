"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";
import { leaseSchema, type LeaseInput } from "@/app/_lib/schemas";
import { normalizeMxPhone } from "@/app/_lib/auth-schemas";
import { inpcAcumulado, calcRenovacion } from "@/app/_lib/inpc";
import { getLeaseAccount } from "@/app/_lib/data/finance";
import { formatMXN } from "@/app/_lib/format";

export type LeaseResult = {
  ok?: true;
  error?: string;
  tempPassword?: string;
  tenantEmail?: string;
};

export async function createLease(input: LeaseInput): Promise<LeaseResult> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };

  const parsed = leaseSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del contrato." };
  const d = parsed.data;
  const orgId = profile.org_id;
  const admin = createAdminClient();

  // The unit must belong to this org.
  const { data: unit } = await admin
    .from("units")
    .select("id, org_id")
    .eq("id", d.unit_id)
    .maybeSingle();
  if (!unit || unit.org_id !== orgId) return { error: "Unidad no válida." };

  const email = d.tenant_email.toLowerCase().trim();
  const phone = normalizeMxPhone(d.tenant_phone ?? "");

  // Reuse an existing tenant in this org (by email), otherwise invite a new one.
  let tenantId: string;
  let tempPassword: string | null = null;
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    tenantId = existing.id;
  } else {
    tempPassword = `Llave-${randomInt(100000, 999999)}`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: d.tenant_full_name },
    });
    if (cErr || !created?.user) {
      return { error: "No se pudo crear el arrendatario (¿el correo ya está en uso?)." };
    }
    tenantId = created.user.id;
    const { error: pErr } = await admin.from("profiles").insert({
      id: tenantId,
      org_id: orgId,
      role: "tenant",
      full_name: d.tenant_full_name,
      email,
      phone,
    });
    if (pErr) return { error: "No se pudo crear el perfil del arrendatario." };
  }

  const { error: lErr } = await admin.from("leases").insert({
    org_id: orgId,
    unit_id: d.unit_id,
    tenant_profile_id: tenantId,
    start_date: d.start_date,
    end_date: d.end_date ? d.end_date : null,
    rent_amount: d.rent_amount,
    deposit_amount: d.deposit_amount,
    payment_day: d.payment_day,
    guarantee_type: d.guarantee_type,
    guarantee_notes: d.guarantee_notes ? d.guarantee_notes : null,
    status: d.activate ? "active" : "pending",
    tenant_is_company: d.tenant_is_company ?? false,
  });
  if (lErr) return { error: "No se pudo crear el contrato." };

  if (d.activate) {
    await admin.from("units").update({ status: "occupied" }).eq("id", d.unit_id);
  }

  revalidatePath("/inquilinos");
  revalidatePath("/propiedades");
  return {
    ok: true,
    tempPassword: tempPassword ?? undefined,
    tenantEmail: email,
  };
}

const LEASE_STATES = ["active", "pending", "ended"] as const;
type LeaseState = (typeof LEASE_STATES)[number];

/** Cambia el estado del contrato (activo/pendiente/terminado) y ajusta la unidad. */
export async function setLeaseStatus(
  leaseId: string,
  status: LeaseState,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (!LEASE_STATES.includes(status)) return { error: "Estado inválido." };

  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id, org_id, unit_id")
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };

  const { error } = await admin.from("leases").update({ status }).eq("id", leaseId);
  if (error) return { error: "No se pudo cambiar el estado." };

  // Mantén la unidad en sync: activo => ocupada; terminado => disponible.
  if (lease.unit_id) {
    if (status === "active")
      await admin.from("units").update({ status: "occupied" }).eq("id", lease.unit_id);
    else if (status === "ended")
      await admin.from("units").update({ status: "vacant" }).eq("id", lease.unit_id);
  }

  revalidatePath("/inquilinos");
  revalidatePath(`/inquilinos/${leaseId}`);
  revalidatePath("/propiedades");
  return { ok: true };
}

/** Renueva el contrato: guarda el historial, sube la renta y mueve la vigencia.
 *  La fórmula del incremento se calcula sola (renta × (1 + %/100)). */
export async function renovarContrato(
  leaseId: string,
  input: { increasePct: number; newRent: number; newEnd?: string | null; note?: string },
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const newRent = Number(input.newRent);
  if (!Number.isFinite(newRent) || newRent < 0) return { error: "Renta nueva inválida." };

  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id, org_id, rent_amount, end_date")
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };

  const pct = Number.isFinite(input.increasePct) ? Number(input.increasePct) : null;
  const newEnd = input.newEnd ? input.newEnd : lease.end_date;

  const { error: rErr } = await admin.from("lease_renewals").insert({
    org_id: lease.org_id,
    lease_id: leaseId,
    previous_rent: lease.rent_amount,
    new_rent: newRent,
    increase_pct: pct,
    previous_end: lease.end_date,
    new_end: newEnd,
    note: input.note?.trim() || null,
    created_by: profile.id,
  });
  if (rErr) return { error: "No se pudo guardar la renovación." };

  const { error: uErr } = await admin
    .from("leases")
    .update({ rent_amount: newRent, end_date: newEnd, annual_increase_pct: pct })
    .eq("id", leaseId);
  if (uErr) return { error: "No se pudo actualizar el contrato." };

  revalidatePath(`/inquilinos/${leaseId}`);
  revalidatePath("/inquilinos");
  revalidatePath("/propiedades");
  revalidatePath("/cobros");
  return { ok: true };
}

/** Guarda la ruta de un acta (entrega/vencimiento) ya subida al bucket documents. */
export async function setActaPath(
  leaseId: string,
  kind: "entrega" | "vencimiento",
  path: string,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  if (kind !== "entrega" && kind !== "vencimiento") return { error: "Documento inválido." };
  if (typeof path !== "string" || !path.startsWith(`${profile.org_id}/`))
    return { error: "Ruta inválida." };

  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id, org_id")
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };

  const col = kind === "entrega" ? "acta_entrega_path" : "acta_vencimiento_path";
  const { error } = await admin.from("leases").update({ [col]: path }).eq("id", leaseId);
  if (error) return { error: "No se pudo guardar el acta." };
  revalidatePath(`/inquilinos/${leaseId}`);
  revalidatePath("/mi-contrato");
  return { ok: true };
}

/** Guarda los datos fiscales del arrendatario (para facturar). */
export async function setTenantFiscal(
  profileId: string,
  input: {
    rfc?: string;
    razon_social?: string;
    regimen_fiscal?: string;
    uso_cfdi?: string;
    requiere_factura?: boolean;
  },
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, org_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!target || target.org_id !== profile.org_id) return { error: "Arrendatario no válido." };

  const { error } = await admin
    .from("profiles")
    .update({
      rfc: input.rfc?.trim().toUpperCase() || null,
      razon_social: input.razon_social?.trim() || null,
      regimen_fiscal: input.regimen_fiscal?.trim() || null,
      uso_cfdi: input.uso_cfdi?.trim() || null,
      requiere_factura: !!input.requiere_factura,
    })
    .eq("id", profileId);
  if (error) return { error: "No se pudieron guardar los datos fiscales." };
  revalidatePath(`/inquilinos/${target.id}`);
  return { ok: true };
}

/** Captura/edita las fechas del contrato (inicio, vigencia/fin) y la cuota de mantenimiento. */
export async function setLeaseDates(
  leaseId: string,
  input: {
    start_date?: string | null;
    end_date?: string | null;
    maintenance_fee?: number;
    parking_fee?: number;
    furniture_fee?: number;
    garantia_monto?: number;
    poliza_vigencia?: string | null;
    pagare_referencia?: string | null;
  },
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id, org_id")
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };

  const fee = Number(input.maintenance_fee);
  const parking = Number(input.parking_fee);
  const furniture = Number(input.furniture_fee);
  const { error } = await admin
    .from("leases")
    .update({
      start_date: input.start_date ? input.start_date : null,
      end_date: input.end_date ? input.end_date : null,
      maintenance_fee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
      parking_fee: Number.isFinite(parking) && parking >= 0 ? parking : 0,
      furniture_fee: Number.isFinite(furniture) && furniture >= 0 ? furniture : 0,
      garantia_monto:
        input.garantia_monto != null && Number.isFinite(Number(input.garantia_monto)) && Number(input.garantia_monto) > 0
          ? Number(input.garantia_monto)
          : null,
      poliza_vigencia: input.poliza_vigencia ? input.poliza_vigencia : null,
      pagare_referencia: input.pagare_referencia?.trim() ? input.pagare_referencia.trim() : null,
    })
    .eq("id", leaseId);
  if (error) return { error: "No se pudieron guardar los datos del contrato." };

  revalidatePath(`/inquilinos/${leaseId}`);
  revalidatePath("/propiedades");
  revalidatePath("/cuotas");
  revalidatePath("/mi-contrato");
  return { ok: true };
}

/** Marca el depósito de un contrato como pagado / pendiente. */
export async function setDepositPaid(
  leaseId: string,
  paid: boolean,
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id, org_id")
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };
  const { error } = await admin.from("leases").update({ deposit_paid: paid }).eq("id", leaseId);
  if (error) return { error: "No se pudo actualizar el depósito." };
  revalidatePath(`/inquilinos/${leaseId}`);
  revalidatePath("/propiedades");
  return { ok: true };
}

/** Genera la carta de propuesta de renovación (PDF) con los valores INPC + margen. */
export async function generarCartaRenovacion(
  leaseId: string,
  desde: string,
  margen: number,
): Promise<{ pdf?: string; filename?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select(
      "org_id, rent_amount, maintenance_fee, end_date, unit:units(label, property:properties(name)), tenant:profiles(full_name)",
    )
    .eq("id", leaseId)
    .maybeSingle();
  if (!lease || lease.org_id !== profile.org_id) return { error: "Contrato no válido." };

  const l = lease as unknown as {
    rent_amount: number;
    maintenance_fee: number;
    end_date: string | null;
    unit?: { label: string; property?: { name: string } | null } | null;
    tenant?: { full_name: string | null } | null;
  };
  const inpc = desde ? inpcAcumulado(desde) : 0;
  const r = calcRenovacion(l.rent_amount, l.maintenance_fee, inpc, margen);
  const tenant = l.tenant?.full_name ?? "Arrendatario";
  const unidad = [l.unit?.property?.name, l.unit?.label].filter(Boolean).join(" ");

  const dmy = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  let vig = "";
  if (l.end_date) {
    const ini = new Date(l.end_date + "T00:00:00Z");
    const fin = new Date(ini);
    fin.setUTCFullYear(fin.getUTCFullYear() + 1);
    vig = `del ${dmy(ini)} al ${dmy(fin)}`;
  }

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const M = 64;
  const maxW = 612 - M * 2;
  let y = 792 - M;
  const orange = rgb(0.878, 0.4, 0.012);
  const dark = rgb(0.13, 0.13, 0.13);
  const gray = rgb(0.42, 0.42, 0.42);

  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const hoy = new Date();
  const fechaTxt = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const text = (s: string, o: { size?: number; f?: typeof font; color?: typeof dark; gap?: number } = {}) => {
    const size = o.size ?? 11, f = o.f ?? font, color = o.color ?? dark, gap = o.gap ?? 5;
    let line = "";
    for (const w of s.split(" ")) {
      const t = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && line) {
        page.drawText(line, { x: M, y: y - size, size, font: f, color });
        y -= size + gap;
        line = w;
      } else line = t;
    }
    if (line) {
      page.drawText(line, { x: M, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };
  const trow = (label: string, a: string, b: string) => {
    page.drawText(label, { x: M, y: y - 11, size: 11, font, color: dark });
    page.drawText(a, { x: M + 210, y: y - 11, size: 11, font, color: gray });
    page.drawText(b, { x: M + 350, y: y - 11, size: 11, font: bold, color: dark });
    y -= 18;
  };

  page.drawText("Metros Redondos", { x: M, y: y - 14, size: 14, font: bold, color: orange });
  y -= 22;
  page.drawText(fechaTxt, { x: M, y: y - 10, size: 10, font, color: gray });
  y -= 28;
  page.drawText("Propuesta de renovación de contrato", { x: M, y: y - 13, size: 13, font: bold, color: dark });
  y -= 28;
  text(`Arrendatario: ${tenant}`, { f: bold, gap: 3 });
  text(`Inmueble: ${unidad}`, { f: bold, gap: 16 });
  text(`Estimado(a) ${tenant}:`, { gap: 8 });
  text(
    `Por medio de la presente le proponemos la renovación de su contrato de arrendamiento correspondiente a ${unidad}. Conforme a la cláusula de actualización anual y al Índice Nacional de Precios al Consumidor (INPC) publicado por el Banco de México, el ajuste para el nuevo periodo es de ${r.aumentoPct.toFixed(2)}% (INPC acumulado ${inpc.toFixed(2)}% más un margen de ${margen}%).`,
    { gap: 6 },
  );
  y -= 12;
  page.drawText("Concepto", { x: M, y: y - 10, size: 10, font: bold, color: gray });
  page.drawText("Actual", { x: M + 210, y: y - 10, size: 10, font: bold, color: gray });
  page.drawText("Propuesto", { x: M + 350, y: y - 10, size: 10, font: bold, color: gray });
  y -= 18;
  trow("Renta", formatMXN(l.rent_amount), formatMXN(r.nuevaRenta));
  trow("Mantenimiento", formatMXN(l.maintenance_fee), formatMXN(r.nuevaCuota));
  trow("Total mensual", formatMXN(l.rent_amount + l.maintenance_fee), formatMXN(r.nuevoTotal));
  y -= 14;
  if (vig) text(`Vigencia propuesta: ${vig}.`, { gap: 16 });
  text("Quedamos a sus órdenes para cualquier aclaración y agradecemos su preferencia.", { gap: 26 });
  text("Atentamente,", { gap: 3 });
  text("Metros Redondos · Administración", { f: bold });

  const bytes = await doc.save();
  const b64 = Buffer.from(bytes).toString("base64");
  const safe = tenant.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
  return { pdf: b64, filename: `Carta-renovacion-${safe}.pdf` };
}

export async function generarRequerimientoPago(
  leaseId: string,
): Promise<{ pdf?: string; filename?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const acc = await getLeaseAccount(leaseId);
  if (!acc) return { error: "Contrato no válido." };
  const { lease, saldo, diasAtraso } = acc;
  if (saldo <= 0) return { error: "Este arrendatario no tiene saldo vencido." };
  const tenant = lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario";
  const unidad = [lease.unit?.property?.name, lease.unit?.label].filter(Boolean).join(" ");

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const M = 64;
  const maxW = 612 - M * 2;
  let y = 792 - M;
  const orange = rgb(0.878, 0.4, 0.012);
  const dark = rgb(0.13, 0.13, 0.13);
  const gray = rgb(0.42, 0.42, 0.42);
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const hoy = new Date();
  const fechaTxt = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const text = (s: string, o: { size?: number; f?: typeof font; color?: typeof dark; gap?: number } = {}) => {
    const size = o.size ?? 11, f = o.f ?? font, color = o.color ?? dark, gap = o.gap ?? 5;
    let line = "";
    for (const w of s.split(" ")) {
      const t = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && line) {
        page.drawText(line, { x: M, y: y - size, size, font: f, color });
        y -= size + gap;
        line = w;
      } else line = t;
    }
    if (line) {
      page.drawText(line, { x: M, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };

  page.drawText("Metros Redondos", { x: M, y: y - 14, size: 14, font: bold, color: orange });
  y -= 22;
  page.drawText(fechaTxt, { x: M, y: y - 10, size: 10, font, color: gray });
  y -= 28;
  page.drawText("Requerimiento de pago", { x: M, y: y - 13, size: 13, font: bold, color: dark });
  y -= 28;
  text(`Arrendatario: ${tenant}`, { f: bold, gap: 3 });
  text(`Inmueble: ${unidad}`, { f: bold, gap: 16 });
  text(`Estimado(a) ${tenant}:`, { gap: 8 });
  text(
    `Por este conducto le requerimos el pago del adeudo vencido a su cargo por concepto de renta del inmueble ${unidad}, que a la fecha asciende a ${formatMXN(saldo)}${diasAtraso > 0 ? `, con ${diasAtraso} días de atraso` : ""}.`,
    { gap: 8 },
  );
  text(
    "Le solicitamos cubrir dicho importe a la brevedad. De no recibir el pago, nos reservamos el derecho de ejercer las acciones previstas en el contrato de arrendamiento y en la legislación aplicable, incluyendo la ejecución de las garantías correspondientes.",
    { gap: 8 },
  );
  text(
    "Si usted ya realizó el pago, por favor haga caso omiso de este aviso y comparta su comprobante.",
    { gap: 26 },
  );
  text("Atentamente,", { gap: 3 });
  text("Metros Redondos · Administración", { f: bold, gap: 44 });
  page.drawText("_______________________________", { x: M, y: y - 10, size: 11, font, color: gray });
  y -= 16;
  page.drawText("Recibí / Enterado", { x: M, y: y - 10, size: 9, font, color: gray });

  const bytes = await doc.save();
  const b64 = Buffer.from(bytes).toString("base64");
  const safe = tenant.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
  return { pdf: b64, filename: `Requerimiento-${safe}.pdf` };
}
