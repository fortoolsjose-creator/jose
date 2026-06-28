import type { GuaranteeType } from "@/app/_lib/types";

export type Riesgo = {
  color: "verde" | "amarillo" | "rojo";
  ratio: number | null; // ingreso / renta
  nota: string;
};

// Scorecard simple y transparente: ingreso vs renta (regla 3x) + tipo de garantía.
export function scoreProspect(
  income: number | null,
  rent: number | null,
  guarantee: GuaranteeType | null,
): Riesgo {
  const ratio = income && rent && rent > 0 ? income / rent : null;
  const garantiaFuerte = guarantee === "aval" || guarantee === "poliza_juridica";

  if (ratio == null) {
    return { color: "amarillo", ratio, nota: "Falta ingreso o renta para calificar" };
  }
  const x = `${ratio.toFixed(1)}× la renta`;
  if (ratio >= 3 && (garantiaFuerte || guarantee === "deposito")) {
    return { color: "verde", ratio, nota: `Ingreso ${x} + garantía` };
  }
  if (ratio >= 3) return { color: "amarillo", ratio, nota: `Ingreso ${x}, sin garantía fuerte` };
  if (ratio >= 2) return { color: "amarillo", ratio, nota: `Ingreso ${x} (ideal 3×)` };
  return { color: "rojo", ratio, nota: `Ingreso solo ${x}` };
}

export const RIESGO_DOT: Record<Riesgo["color"], string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-500",
  rojo: "bg-red-500",
};
