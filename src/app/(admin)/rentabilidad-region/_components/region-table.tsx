"use client";

import { useMemo, useState } from "react";
import { formatMXN } from "@/app/_lib/format";
import type { BuildingProfit } from "@/app/_lib/data/profitability";

const DIMS = [
  { key: "municipio", label: "Alcaldía" },
  { key: "colonia", label: "Colonia" },
  { key: "ciudad", label: "Ciudad" },
] as const;
type DimKey = (typeof DIMS)[number]["key"];

type Group = {
  region: string;
  propiedades: number;
  units: number;
  occupied: number;
  ingreso: number;
  noi: number;
};

export function RegionTable({ buildings }: { buildings: BuildingProfit[] }) {
  const [dim, setDim] = useState<DimKey>("municipio");

  const { groups, total } = useMemo(() => {
    const map = new Map<string, Group>();
    for (const b of buildings) {
      const raw = b[dim];
      const region = raw && raw.trim() ? raw.trim() : "Sin región";
      const g =
        map.get(region) ??
        { region, propiedades: 0, units: 0, occupied: 0, ingreso: 0, noi: 0 };
      g.propiedades += 1;
      g.units += b.units;
      g.occupied += b.occupied;
      g.ingreso += b.ingresoEsperado;
      g.noi += b.noi;
      map.set(region, g);
    }
    const groups = [...map.values()].sort((a, b) => b.ingreso - a.ingreso);
    const total = groups.reduce((s, g) => s + g.ingreso, 0);
    return { groups, total };
  }, [buildings, dim]);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border p-0.5">
        {DIMS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDim(d.key)}
            className={`rounded-md px-3 py-1 text-sm transition ${
              dim === d.key
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">Región</th>
              <th className="px-3 py-2 text-right font-medium">Props</th>
              <th className="px-3 py-2 text-right font-medium">Unidades</th>
              <th className="px-3 py-2 text-right font-medium">Ocupación</th>
              <th className="px-3 py-2 text-right font-medium">Ingreso / mes</th>
              <th className="px-3 py-2 text-right font-medium">% del total</th>
              <th className="px-3 py-2 text-right font-medium">NOI / mes</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.region} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{g.region}</td>
                <td className="px-3 py-2 text-right tabular-nums">{g.propiedades}</td>
                <td className="px-3 py-2 text-right tabular-nums">{g.units}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {g.units > 0 ? `${Math.round((g.occupied / g.units) * 100)}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMXN(g.ingreso)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {total > 0 ? `${Math.round((g.ingreso / total) * 100)}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMXN(g.noi)}</td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-3 py-6 text-center">
                  Sin propiedades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
