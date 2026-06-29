// Comparadores reutilizables para los selectores "Ordenar por".
// Las fechas nulas siempre van al final (en ambos sentidos).

export function dateAsc(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function dateDesc(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a > b ? -1 : a < b ? 1 : 0;
}

export const strCmp = (a: string, b: string) => (a || "").localeCompare(b || "", "es");
