"use server";

import ExcelJS from "exceljs";
import { getProfile } from "@/app/_lib/dal";
import { getProfitability } from "@/app/_lib/data/profitability";
import {
  getExpenseReport,
  getCollectionAging,
  getMonthlyTrend,
  getPaymentReport,
} from "@/app/_lib/data/reports";
import { EXPENSE_CATEGORY_LABELS } from "@/app/_lib/types";

const MONEY = '"$"#,##0.00';
const PCT = "0.0%";

export async function exportReportesXlsx(): Promise<{
  base64?: string;
  filename?: string;
  error?: string;
}> {
  const profile = await getProfile();
  if (profile?.role !== "owner") {
    return { error: "Solo los dueños pueden exportar los reportes." };
  }

  const [prof, gastos, aging, trend, pay] = await Promise.all([
    getProfitability(),
    getExpenseReport(),
    getCollectionAging(),
    getMonthlyTrend(12),
    getPaymentReport(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Metros Redondos";

  // --- Rentabilidad por edificio ---
  const r = wb.addWorksheet("Rentabilidad");
  r.columns = [
    { header: "Edificio", key: "name", width: 22 },
    { header: "Ciudad", key: "ciudad", width: 16 },
    { header: "Alcaldía", key: "municipio", width: 18 },
    { header: "Unidades", key: "units", width: 10 },
    { header: "Ocupadas", key: "occupied", width: 10 },
    { header: "Ingreso/mes", key: "ingresoEsperado", width: 15 },
    { header: "Gastos/mes", key: "gastos", width: 14 },
    { header: "NOI/mes", key: "noi", width: 14 },
    { header: "Cap rate", key: "capRate", width: 10 },
  ];
  prof.buildings.forEach((b) =>
    r.addRow({
      name: b.name,
      ciudad: b.ciudad ?? "",
      municipio: b.municipio ?? "",
      units: b.units,
      occupied: b.occupied,
      ingresoEsperado: b.ingresoEsperado,
      gastos: b.gastos,
      noi: b.noi,
      capRate: b.capRate ?? null,
    }),
  );
  r.addRow({
    name: "TOTAL",
    units: prof.totals.units,
    occupied: prof.totals.occupied,
    ingresoEsperado: prof.totals.ingresoEsperado,
    gastos: prof.totals.gastos,
    noi: prof.totals.noi,
  });
  ["ingresoEsperado", "gastos", "noi"].forEach((k) => (r.getColumn(k).numFmt = MONEY));
  r.getColumn("capRate").numFmt = PCT;

  // --- Cobranza (aging) ---
  const a = wb.addWorksheet("Cobranza");
  a.addRow(["Tasa de cobranza (histórica)", aging.rate]);
  a.addRow(["Facturado (histórico)", aging.totalDue]);
  a.addRow(["Cobrado (histórico)", aging.totalPaid]);
  a.addRow([]);
  a.addRow(["Antigüedad de cartera", "Monto vencido"]);
  aging.buckets.forEach((b) => a.addRow([b.label, b.monto]));
  a.getCell("B1").numFmt = PCT;
  ["B2", "B3"].forEach((c) => (a.getCell(c).numFmt = MONEY));
  for (let i = 6; i <= 5 + aging.buckets.length; i++) a.getCell(`B${i}`).numFmt = MONEY;
  a.getColumn(1).width = 26;
  a.getColumn(2).width = 16;

  // --- Gastos por categoría ---
  const g = wb.addWorksheet("Gastos");
  g.columns = [
    { header: "Categoría", key: "cat", width: 22 },
    { header: "Total", key: "total", width: 14 },
    { header: "Con factura", key: "con", width: 14 },
  ];
  gastos.rows.forEach((row) =>
    g.addRow({
      cat: EXPENSE_CATEGORY_LABELS[row.category] ?? row.category,
      total: row.total,
      con: row.conFactura,
    }),
  );
  g.addRow({ cat: "TOTAL", total: gastos.total, con: gastos.totalConFactura });
  ["total", "con"].forEach((k) => (g.getColumn(k).numFmt = MONEY));

  // --- Tendencia (facturado vs cobrado) ---
  const t = wb.addWorksheet("Tendencia");
  t.columns = [
    { header: "Mes", key: "period", width: 12 },
    { header: "Facturado", key: "facturado", width: 14 },
    { header: "Cobrado", key: "cobrado", width: 14 },
  ];
  trend.forEach((m) => t.addRow(m));
  ["facturado", "cobrado"].forEach((k) => (t.getColumn(k).numFmt = MONEY));

  // --- Facturación + puntualidad ---
  const f = wb.addWorksheet("Facturación");
  f.addRow(["Concepto", "Operaciones", "Monto"]);
  f.addRow(["Con factura", pay.facturacion.con.n, pay.facturacion.con.monto]);
  f.addRow(["Sin factura", pay.facturacion.sin.n, pay.facturacion.sin.monto]);
  f.addRow(["Factura pendiente", pay.facturacion.pendiente.n, pay.facturacion.pendiente.monto]);
  f.addRow([]);
  f.addRow(["Puntualidad (pagos a tiempo)", pay.puntualidad.aTiempo, pay.puntualidad.total]);
  f.getColumn(1).width = 26;
  f.getColumn(3).numFmt = MONEY;

  // Encabezados en negrita en cada hoja.
  wb.eachSheet((ws) => {
    ws.getRow(1).font = { bold: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buf).toString("base64");
  return { base64, filename: `reportes-metros-redondos-${prof.period.slice(0, 7)}.xlsx` };
}
