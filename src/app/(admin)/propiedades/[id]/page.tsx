import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DoorOpen } from "lucide-react";
import { getProfile } from "@/app/_lib/dal";
import { getProperty, listUnitsWithLease } from "@/app/_lib/data/properties";
import { listDocuments } from "@/app/_lib/data/documents";
import { listValuations, plusvaliaFrom, capitalGain } from "@/app/_lib/data/valuations";
import { listEntityOptions } from "@/app/_lib/data/entities";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { ExpedienteDocs } from "@/app/_components/expediente-docs";
import { ValuationEditor } from "../_components/valuation-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/app/_lib/format";
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_DOC_KINDS,
  UNIT_STATUS_LABELS,
  type UnitStatus,
} from "@/app/_lib/types";
import { PropertyDialog } from "../_components/property-dialog";
import { UnitDialog } from "../_components/unit-dialog";
import { ConfirmDeleteButton } from "../_components/confirm-delete-button";
import { deleteProperty, deleteUnit } from "../actions";

export const metadata: Metadata = { title: "Propiedad" };

const STATUS_VARIANT: Record<UnitStatus, "default" | "secondary" | "outline"> = {
  occupied: "default",
  vacant: "secondary",
  maintenance: "outline",
};

export default async function PropertyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const property = await getProperty(id);
  if (!property) notFound();
  const [units, propertyDocs, valuations, profile, entities] = await Promise.all([
    listUnitsWithLease(id),
    listDocuments("property", id),
    listValuations(id),
    getProfile(),
    listEntityOptions(),
  ]);
  const plusvalia = plusvaliaFrom(valuations);
  const isOwner = profile?.role === "owner";
  const valorActual = valuations[0]?.market_value ?? property.market_value ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const gain = capitalGain(
    property.purchase_price,
    property.purchase_date,
    valorActual,
    valuations[0]?.valued_on ?? today,
  );

  const address = [
    property.street,
    property.ext_number && `#${property.ext_number}`,
    property.int_number && `int. ${property.int_number}`,
    property.colonia,
    property.municipio,
    property.cp,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Link
        href="/propiedades"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Propiedades
      </Link>

      <PageHeader
        title={property.name}
        subtitle={`${PROPERTY_TYPE_LABELS[property.type]}${address ? ` · ${address}` : ""}`}
        action={
          <div className="flex gap-2">
            <PropertyDialog property={property} entities={entities} />
            <ConfirmDeleteButton
              onConfirm={deleteProperty.bind(null, property.id)}
              title="¿Eliminar propiedad?"
              description="Se ocultará la propiedad y sus unidades. Esta acción se puede revertir desde la base de datos."
              redirectTo="/propiedades"
            />
          </div>
        }
      />

      <div className="mb-6 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Expediente de la propiedad</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Fotos, escritura, boleta predial, póliza de seguro, planos…
        </p>
        <ExpedienteDocs
          orgId={property.org_id}
          ownerType="property"
          ownerId={property.id}
          docs={propertyDocs}
          kindOptions={[...PROPERTY_DOC_KINDS, "avaluo", "otro"]}
          expectedKinds={[...PROPERTY_DOC_KINDS]}
        />
      </div>

      {isOwner && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Valor y plusvalía</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Registra el valor del inmueble en el tiempo (avalúos, estimados) para ver
            cuánto ha subido.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Precio de compra</p>
              <p className="text-lg font-bold">
                {property.purchase_price ? formatMXN(property.purchase_price) : "—"}
              </p>
              {property.purchase_date && (
                <p className="text-muted-foreground text-xs">{formatDate(property.purchase_date)}</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Valor actual</p>
              <p className="text-lg font-bold">
                {valorActual != null ? formatMXN(valorActual) : "—"}
              </p>
              {valuations[0] && (
                <p className="text-muted-foreground text-xs">{formatDate(valuations[0].valued_on)}</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Ganancia de capital</p>
              {gain ? (
                <>
                  <p
                    className={`text-lg font-bold ${gain.ganancia >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {gain.ganancia >= 0 ? "+" : ""}
                    {formatMXN(gain.ganancia)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {(gain.pct * 100).toFixed(1)}%
                    {gain.annualPct != null && ` · ${(gain.annualPct * 100).toFixed(1)}%/año`}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Captura el precio de compra (botón Editar) y al menos un valor.
                </p>
              )}
            </div>
          </div>
          <ValuationEditor
            propertyId={property.id}
            valuations={valuations}
            plusvalia={plusvalia}
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Unidades</h2>
        <UnitDialog propertyId={property.id} />
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="Sin unidades"
          description="Agrega las unidades de esta propiedad (departamentos, casa, etc.)."
          action={<UnitDialog propertyId={property.id} />}
        />
      ) : (
        <div className="space-y-3">
          {units.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.label}</span>
                    <Badge variant={STATUS_VARIANT[u.status]}>
                      {UNIT_STATUS_LABELS[u.status]}
                    </Badge>
                  </div>
                  {u.lease ? (
                    <>
                      <p className="text-muted-foreground text-sm">
                        {[
                          `Renta ${formatMXN(u.lease.rent_amount)}`,
                          u.lease.start_date || u.lease.end_date
                            ? `Vigencia ${u.lease.start_date ? formatDate(u.lease.start_date) : "—"} a ${u.lease.end_date ? formatDate(u.lease.end_date) : "—"}`
                            : "Vigencia no capturada",
                          u.lease.renewals > 0 &&
                            `${u.lease.renewals} renovación${u.lease.renewals === 1 ? "" : "es"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1">
                        <Badge variant={u.lease.deposit_paid ? "default" : "destructive"}>
                          {u.lease.deposit_paid ? "Depósito pagado" : "Depósito pendiente"}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {[
                        u.use_type === "residential" &&
                          u.bedrooms != null &&
                          `${u.bedrooms} rec`,
                        u.use_type === "residential" &&
                          u.bathrooms != null &&
                          `${u.bathrooms} baños`,
                        `Renta ${formatMXN(u.rent_amount)}`,
                        "Sin contrato activo",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {u.rent_market_avg != null && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Mercado: {formatMXN(u.rent_market_min ?? 0)} – {formatMXN(u.rent_market_avg)} – {formatMXN(u.rent_market_max ?? 0)}
                      {(() => {
                        const cur = u.lease?.rent_amount ?? u.rent_amount;
                        const min = u.rent_market_min ?? 0;
                        return cur > 0 && min > 0 && cur < min ? (
                          <span className="text-primary font-medium"> · por debajo del mercado</span>
                        ) : null;
                      })()}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <UnitDialog propertyId={property.id} unit={u} />
                  <ConfirmDeleteButton
                    onConfirm={deleteUnit.bind(null, u.id, property.id)}
                    title="¿Eliminar unidad?"
                    description={`Se ocultará "${u.label}".`}
                    triggerLabel=""
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
