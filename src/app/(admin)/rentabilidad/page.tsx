import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/app/_lib/dal";
import { getProfitability } from "@/app/_lib/data/profitability";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart } from "lucide-react";
import { formatMXN, formatMonth } from "@/app/_lib/format";

export const metadata: Metadata = { title: "Rentabilidad" };

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default async function RentabilidadPage() {
  const profile = await getProfile();
  if (profile?.role !== "owner") redirect("/panel");
  const { period, buildings, totals } = await getProfitability();

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        subtitle={`Cuánto deja cada edificio · ${formatMonth(period)}`}
      />

      <div className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ingreso esperado" value={formatMXN(totals.ingresoEsperado)} />
        <Stat label="Gastos" value={formatMXN(totals.gastos)} />
        <Stat
          label="NOI (ganancia operativa)"
          value={formatMXN(totals.noi)}
          tone={totals.noi < 0 ? "danger" : undefined}
        />
        <Stat label="Ocupación (unidades)" value={pct(totals.occupancy)} />
        <Stat
          label="Sin captar / mes"
          value={formatMXN(totals.rentaPotencial - totals.ingresoEsperado)}
          tone={totals.rentaPotencial - totals.ingresoEsperado > 0 ? "danger" : undefined}
        />
      </div>
      <p className="text-muted-foreground mb-6 text-xs">
        <b>Tu frontera de ingreso</b> (todo rentado a precio de lista) es{" "}
        {formatMXN(totals.rentaPotencial)}; hoy tienes contratado{" "}
        {formatMXN(totals.ingresoEsperado)}. La diferencia —{" "}
        <b className="text-foreground">
          {formatMXN(totals.rentaPotencial - totals.ingresoEsperado)} al mes
        </b>{" "}
        ({formatMXN((totals.rentaPotencial - totals.ingresoEsperado) * 12)} al año) — es
        dinero que dejas de ganar por unidades vacías o rentadas debajo de su precio.
      </p>

      <div className="bg-muted/40 mb-6 rounded-lg border p-3 text-sm">
        <p className="mb-1 font-medium">Fiscal (estimado)</p>
        <p className="text-muted-foreground">
          IVA por cobrar (16% de lo comercial): {formatMXN(totals.ivaEstimado)} ·
          Retención que te hacen las empresas (10%): {formatMXN(totals.retencionEstimada)}.
          Lo residencial está exento de IVA. Son estimaciones — confírmalo con tu contador.
        </p>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Por edificio</h2>
      {buildings.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Sin datos todavía"
          description="Cuando tengas propiedades y contratos activos, aquí verás la ganancia de cada edificio."
        />
      ) : (
        <div className="space-y-3">
          {buildings.map((b) => (
            <Card key={b.property_id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {b.occupied}/{b.units} unidades · {pct(b.occupancy)}
                      {b.rentaPotencial - b.ingresoEsperado > 0
                        ? ` · sin captar ${formatMXN(b.rentaPotencial - b.ingresoEsperado)}/mes`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">NOI / mes</p>
                    <p className={`text-xl font-bold ${b.noi < 0 ? "text-destructive" : ""}`}>
                      {formatMXN(b.noi)}
                    </p>
                    {b.capRate != null ? (
                      <p className="text-muted-foreground text-xs">cap rate {pct(b.capRate)}</p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        agrega el valor en Propiedades para el cap rate
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <Mini label="Ingreso" value={formatMXN(b.ingresoEsperado)} />
                  <Mini label="Gastos" value={formatMXN(b.gastos)} />
                  <Mini label="Comercial (con IVA)" value={formatMXN(b.ingresoComercial)} />
                  <Mini label="Residencial (exento)" value={formatMXN(b.ingresoResidencial)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totals.gastosGenerales > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">
          Nota: {formatMXN(totals.gastosGenerales)} en gastos generales (sin edificio
          asignado) están en el NOI total pero no en ningún edificio.
        </p>
      )}
    </>
  );
}
