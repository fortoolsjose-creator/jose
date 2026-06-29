/**
 * es-MX formatting helpers. Safe to use on both server and client.
 */

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  // Muestra decimales solo cuando importan: $14,020 (no $14,020.00), pero $14,020.50 si hay centavos.
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DATE_LONG = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const MONTH_YEAR = new Intl.DateTimeFormat("es-MX", {
  month: "long",
  year: "numeric",
});

/** "$12,500.00" */
export function formatMXN(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return MXN.format(n ?? 0);
}

/** "18 de junio de 2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_LONG.format(d);
}

/** "junio de 2026" — for a payment period month */
export function formatMonth(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return MONTH_YEAR.format(d);
}
