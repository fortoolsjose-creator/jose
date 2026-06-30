"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { inpcAcumulado, calcRenovacion, latestInpcYm } from "@/app/_lib/inpc";
import { formatMXN, formatMonth } from "@/app/_lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generarCartaRenovacion } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const m2peso = (v: number) => `$${Math.round(v).toLocaleString("es-MX")}/m²`;

export function RenovacionCalc({
  leaseId,
  renta,
  cuota,
  desdeDefault,
  m2,
  marketMin,
  marketAvg,
  marketMax,
}: {
  leaseId: string;
  renta: number;
  cuota: number;
  desdeDefault: string;
  m2?: number | null;
  marketMin?: number | null;
  marketAvg?: number | null;
  marketMax?: number | null;
}) {
  const [desde, setDesde] = useState(desdeDefault);
  const [margen, setMargen] = useState("2.5");
  const [objetivoM2, setObjetivoM2] = useState("");
  const [cuotaOverride, setCuotaOverride] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pending, start] = useTransition();

  function generarCarta() {
    start(async () => {
      const cov = parseFloat(cuotaOverride) || 0;
      const res = await generarCartaRenovacion(
        leaseId,
        desde,
        parseFloat(margen) || 0,
        deadline || undefined,
        cov > 0 ? cov : undefined,
      );
      if (res.error || !res.pdf) {
        toast.error(res.error ?? "No se pudo generar la carta.");
        return;
      }
      const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? "carta-renovacion.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  const margenNum = parseFloat(margen) || 0;
  const inpc = desde ? inpcAcumulado(desde) : 0;
  const r = calcRenovacion(renta, cuota, inpc, margenNum);

  // La cuota de mantenimiento la puede fijar el condominio en un nuevo monto
  // (no siempre sigue el INPC). Si se captura, manda sobre el cálculo automático.
  const cuotaOvNum = parseFloat(cuotaOverride) || 0;
  const nuevaCuotaEff = cuotaOvNum > 0 ? cuotaOvNum : r.nuevaCuota;
  const nuevoTotalEff = r.nuevaRenta + nuevaCuotaEff;

  const proy: { año: number; renta: number; cuota: number; total: number }[] = [];
  let rr = renta;
  let cc = cuota;
  for (let i = 1; i <= 5; i++) {
    rr = Math.round(rr * (1 + r.aumentoPct / 100));
    cc = i === 1 && cuotaOvNum > 0 ? cuotaOvNum : Math.round(cc * (1 + r.aumentoPct / 100));
    proy.push({ año: i, renta: rr, cuota: cc, total: rr + cc });
  }

  const tieneM2 = !!m2 && m2 > 0;
  const objNum = parseFloat(objetivoM2) || 0;
  const rentaObjetivo = tieneM2 && objNum > 0 ? Math.round(objNum * (m2 as number)) : 0;
  const tieneMercado = (marketMin ?? 0) > 0 || (marketAvg ?? 0) > 0 || (marketMax ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="desde">Desde (última renovación o inicio)</Label>
          <Input
            id="desde"
            type="month"
            value={desde}
            max={latestInpcYm()}
            onChange={(e) => setDesde(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="margen">Margen sobre INPC</Label>
          <select id="margen" className={`${selectClass} w-28`} value={margen} onChange={(e) => setMargen(e.target.value)}>
            <option value="2.5">+ 2.5%</option>
            <option value="1.5">+ 1.5%</option>
            <option value="1">+ 1%</option>
            <option value="0">Solo INPC</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cuotaov">Nueva cuota (si el condominio la cambió)</Label>
          <Input
            id="cuotaov"
            type="number"
            min={0}
            value={cuotaOverride}
            onChange={(e) => setCuotaOverride(e.target.value)}
            placeholder={`auto ${formatMXN(r.nuevaCuota)}`}
            className="w-48"
          />
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          INPC acumulado <span className="text-foreground font-medium">{inpc.toFixed(2)}%</span> + margen{" "}
          {margenNum}% = aumento <span className="text-primary font-bold">{r.aumentoPct.toFixed(2)}%</span>
          <span className="text-muted-foreground"> · INPC hasta {formatMonth(latestInpcYm() + "-01")}</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <p className="text-muted-foreground text-xs">Renta</p>
            <p className="font-medium">{formatMXN(renta)} → {formatMXN(r.nuevaRenta)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Cuota{cuotaOvNum > 0 ? " (manual)" : ""}</p>
            <p className="font-medium">{formatMXN(cuota)} → {formatMXN(nuevaCuotaEff)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total / mes</p>
            <p className="font-bold">{formatMXN(renta + cuota)} → {formatMXN(nuevoTotalEff)}</p>
          </div>
        </div>
        {tieneM2 && (
          <div className="text-muted-foreground mt-2 space-y-0.5 border-t pt-2 text-xs">
            <p>
              {(m2 as number).toLocaleString("es-MX")} m² · Renta por m²:{" "}
              <span className="text-foreground font-medium">{m2peso(renta / (m2 as number))}</span> →{" "}
              <span className="text-foreground font-medium">{m2peso(r.nuevaRenta / (m2 as number))}</span>
            </p>
            {tieneMercado && (
              <p>
                Mercado por m²:
                {(marketMin ?? 0) > 0 && (
                  <> mín <span className="text-foreground font-medium">{m2peso((marketMin as number) / (m2 as number))}</span></>
                )}
                {(marketAvg ?? 0) > 0 && (
                  <> · prom <span className="text-foreground font-medium">{m2peso((marketAvg as number) / (m2 as number))}</span></>
                )}
                {(marketMax ?? 0) > 0 && (
                  <> · máx <span className="text-foreground font-medium">{m2peso((marketMax as number) / (m2 as number))}</span></>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {tieneM2 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="objm2">Precio objetivo por m² (opcional)</Label>
            <Input
              id="objm2"
              type="number"
              min={0}
              value={objetivoM2}
              onChange={(e) => setObjetivoM2(e.target.value)}
              placeholder="ej. 700"
              className="w-36"
            />
          </div>
          {rentaObjetivo > 0 && (
            <p className="text-sm">
              A {m2peso(objNum)} → renta <span className="font-bold">{formatMXN(rentaObjetivo)}</span>
              <span className="text-muted-foreground"> (vs {formatMXN(renta)} actual)</span>
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          Proyección a 5 años (si el aumento se mantiene en {r.aumentoPct.toFixed(2)}%/año)
        </p>
        <div className="divide-y rounded-lg border text-sm">
          <div className="text-muted-foreground grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-medium">
            <span>Año</span>
            <span className="text-right">Renta</span>
            <span className="text-right">Cuota</span>
            <span className="text-right">Total</span>
          </div>
          {proy.map((p) => (
            <div key={p.año} className="grid grid-cols-4 gap-2 px-3 py-1.5">
              <span>Año {p.año}</span>
              <span className="text-right">{formatMXN(p.renta)}</span>
              <span className="text-muted-foreground text-right">{formatMXN(p.cuota)}</span>
              <span className="text-right font-medium">{formatMXN(p.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Fecha límite para que conteste (opcional)</Label>
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-44"
          />
        </div>
        <Button size="sm" variant="outline" onClick={generarCarta} disabled={pending}>
          <FileText className="size-4" /> {pending ? "Generando…" : "Generar carta de renovación (PDF)"}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Cálculo con el INPC de Banxico (igual que tu calculadora). Ajusta el mes de “desde” a la
        última renovación de este contrato.
      </p>
    </div>
  );
}
