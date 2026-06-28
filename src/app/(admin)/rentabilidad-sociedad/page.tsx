import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/app/_lib/dal";
import { getEntityProfitability } from "@/app/_lib/data/entity-profit";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Landmark } from "lucide-react";
import { formatMXN } from "@/app/_lib/format";

export const metadata: Metadata = { title: "Rentabilidad por sociedad" };

export default async function RentabilidadSociedadPage() {
  const profile = await getProfile();
  if (profile?.role !== "owner") redirect("/panel");
  const rows = await getEntityProfitability();
  const hayDatos = rows.some((r) => r.entity_id !== null);

  return (
    <>
      <PageHeader
        title="Rentabilidad por sociedad"
        subtitle="Estado de resultados del mes por entidad legal (CIT/PH/SPH/CIMMA)."
      />

      {!hayDatos ? (
        <EmptyState
          icon={Landmark}
          title="Asigna tus edificios a una sociedad"
          description="Crea las sociedades en Administración → Sociedades y asigna cada edificio a la suya en Propiedades → Editar. Aquí verás el ingreso, gasto y NOI de cada una."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.entity_id ?? "sin"}>
              <CardContent className="py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">{r.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.edificios} {r.edificios === 1 ? "edificio" : "edificios"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Ingreso / mes</p>
                    <p className="font-semibold">{formatMXN(r.ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Gastos / mes</p>
                    <p className="font-semibold">{formatMXN(r.gastos)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">NOI / mes</p>
                    <p className={`font-semibold ${r.noi < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatMXN(r.noi)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-muted-foreground text-xs">
            Ingreso = renta + cuota de contratos activos. Gastos = gastos directos del edificio +
            gastos compartidos repartidos por %. “Sin sociedad” = edificios o gastos aún sin asignar.
          </p>
        </div>
      )}
    </>
  );
}
