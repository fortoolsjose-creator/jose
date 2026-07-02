// Tabla mensual de INPC (inflación de Banxico), tomada de la calculadora de Magaly.
// `pct` = % de inflación de ESE mes. Actualizar cada mes con el dato nuevo de Banxico.
// (Generado por scripts/gen-inpc.py — no editar a mano salvo para agregar el mes nuevo.)
export type InpcRow = { ym: string; pct: number };

export const INPC_MONTHLY: InpcRow[] = [
  { ym: "2016-06", pct: 0.11 },
  { ym: "2016-07", pct: 0.26 },
  { ym: "2016-08", pct: 0.28 },
  { ym: "2016-09", pct: 0.61 },
  { ym: "2016-10", pct: 0.61 },
  { ym: "2016-11", pct: 0.78 },
  { ym: "2016-12", pct: 0.46 },
  { ym: "2017-01", pct: 1.7 },
  { ym: "2017-02", pct: 0.58 },
  { ym: "2017-03", pct: 0.61 },
  { ym: "2017-04", pct: 0.12 },
  { ym: "2017-05", pct: -0.12 },
  { ym: "2017-06", pct: 0.25 },
  { ym: "2017-07", pct: 0.38 },
  { ym: "2017-08", pct: 0.49 },
  { ym: "2017-09", pct: 0.31 },
  { ym: "2017-10", pct: 0.63 },
  { ym: "2017-11", pct: 1.03 },
  { ym: "2017-12", pct: 0.59 },
  { ym: "2018-01", pct: 0.53 },
  { ym: "2018-02", pct: 0.38 },
  { ym: "2018-03", pct: 0.32 },
  { ym: "2018-04", pct: -0.34 },
  { ym: "2018-05", pct: -0.16 },
  { ym: "2018-06", pct: 0.39 },
  { ym: "2018-07", pct: 0.54 },
  { ym: "2018-08", pct: 0.58 },
  { ym: "2018-09", pct: 0.42 },
  { ym: "2018-10", pct: 0.52 },
  { ym: "2018-11", pct: 0.85 },
  { ym: "2018-12", pct: 0.7 },
  { ym: "2019-01", pct: 0.09 },
  { ym: "2019-02", pct: -0.03 },
  { ym: "2019-03", pct: 0.39 },
  { ym: "2019-04", pct: 0.05 },
  { ym: "2019-05", pct: -0.29 },
  { ym: "2019-06", pct: 0.06 },
  { ym: "2019-07", pct: 0.38 },
  { ym: "2019-08", pct: -0.02 },
  { ym: "2019-09", pct: 0.26 },
  { ym: "2019-10", pct: 0.54 },
  { ym: "2019-11", pct: 0.81 },
  { ym: "2019-12", pct: 0.56 },
  { ym: "2020-01", pct: 0.48 },
  { ym: "2020-02", pct: 0.42 },
  { ym: "2020-03", pct: -0.05 },
  { ym: "2020-04", pct: -1.01 },
  { ym: "2020-05", pct: 0.38 },
  { ym: "2020-06", pct: 0.55 },
  { ym: "2020-07", pct: 0.66 },
  { ym: "2020-08", pct: 0.39 },
  { ym: "2020-09", pct: 0.23 },
  { ym: "2020-10", pct: 0.61 },
  { ym: "2020-11", pct: 0.08 },
  { ym: "2020-12", pct: 0.38 },
  { ym: "2021-01", pct: 0.86 },
  { ym: "2021-02", pct: 0.63 },
  { ym: "2021-03", pct: 0.83 },
  { ym: "2021-04", pct: 0.33 },
  { ym: "2021-05", pct: 0.2 },
  { ym: "2021-06", pct: 0.53 },
  { ym: "2021-07", pct: 0.59 },
  { ym: "2021-08", pct: 0.19 },
  { ym: "2021-09", pct: 0.62 },
  { ym: "2021-10", pct: 0.84 },
  { ym: "2021-11", pct: 1.14 },
  { ym: "2021-12", pct: 0.36 },
  { ym: "2022-01", pct: 0.59 },
  { ym: "2022-02", pct: 0.83 },
  { ym: "2022-03", pct: 0.99 },
  { ym: "2022-04", pct: 0.54 },
  { ym: "2022-05", pct: 0.18 },
  { ym: "2022-06", pct: 0.84 },
  { ym: "2022-07", pct: 0.74 },
  { ym: "2022-08", pct: 0.7 },
  { ym: "2022-09", pct: 0.62 },
  { ym: "2022-10", pct: 0.57 },
  { ym: "2022-11", pct: 0.58 },
  { ym: "2022-12", pct: 0.38 },
  { ym: "2023-01", pct: 0.68 },
  { ym: "2023-02", pct: 0.56 },
  { ym: "2023-03", pct: 0.24 },
  { ym: "2023-04", pct: -0.02 },
  { ym: "2023-05", pct: -0.22 },
  { ym: "2023-06", pct: 0.1 },
  { ym: "2023-07", pct: 0.48 },
  { ym: "2023-08", pct: 0.55 },
  { ym: "2023-09", pct: 0.44 },
  { ym: "2023-10", pct: 0.38 },
  { ym: "2023-11", pct: 0.64 },
  { ym: "2023-12", pct: 0.71 },
  { ym: "2024-01", pct: 0.89 },
  { ym: "2024-02", pct: 0.09 },
  { ym: "2024-03", pct: 0.29 },
  { ym: "2024-04", pct: 0.2 },
  { ym: "2024-05", pct: -0.19 },
  { ym: "2024-06", pct: 0.38 },
  { ym: "2024-07", pct: 1.05 },
  { ym: "2024-08", pct: 0.01 },
  { ym: "2024-09", pct: 0.05 },
  { ym: "2024-10", pct: 0.55 },
  { ym: "2024-11", pct: 0.44 },
  { ym: "2024-12", pct: 0.38 },
  { ym: "2025-01", pct: 0.31 },
  { ym: "2025-02", pct: 0.32 },
  { ym: "2025-03", pct: 0.33 },
  { ym: "2025-04", pct: 0.37 },
  { ym: "2025-05", pct: 0.37 },
  { ym: "2025-06", pct: 0.35 },
  { ym: "2025-07", pct: 0.27 },
  { ym: "2025-08", pct: 0.06 },
  { ym: "2025-09", pct: 0.26 },
  { ym: "2025-10", pct: 0.36 },
  { ym: "2025-11", pct: 0.8 },
  { ym: "2025-12", pct: 0.28 },
  { ym: "2026-01", pct: 0.38 },
  { ym: "2026-02", pct: 0.5 },
  { ym: "2026-03", pct: 0.86 },
  { ym: "2026-04", pct: 0.31 },
  { ym: "2026-05", pct: -0.22 }
];

export function latestInpcYm(): string {
  return INPC_MONTHLY.length ? INPC_MONTHLY[INPC_MONTHLY.length - 1].ym : "";
}

/** Suma del INPC desde el mes SIGUIENTE a `desdeYm` hasta `hastaYm` (o el último). En %. */
export function inpcAcumulado(desdeYm: string, hastaYm?: string): number {
  const hasta = hastaYm ?? latestInpcYm();
  return INPC_MONTHLY.filter((r) => r.ym > desdeYm && r.ym <= hasta).reduce((s, r) => s + r.pct, 0);
}

export type RenovacionCalc = {
  inpcPct: number;
  margenPct: number;
  aumentoPct: number;
  nuevaRenta: number;
  nuevaCuota: number;
  nuevoTotal: number;
};

/** Renta/cuota nuevas = actuales x (1 + (INPC acumulado + margen)/100). Redondeado. */
export function calcRenovacion(
  renta: number,
  cuota: number,
  inpcPct: number,
  margenPct: number,
): RenovacionCalc {
  const aumentoPct = inpcPct + margenPct;
  const f = 1 + aumentoPct / 100;
  const nuevaRenta = Math.round(renta * f);
  const nuevaCuota = Math.round(cuota * f);
  return { inpcPct, margenPct, aumentoPct, nuevaRenta, nuevaCuota, nuevoTotal: nuevaRenta + nuevaCuota };
}
