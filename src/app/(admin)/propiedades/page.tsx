import type { Metadata, Route } from "next";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { listProperties } from "@/app/_lib/data/properties";
import { getProfitability, type BuildingProfit } from "@/app/_lib/data/profitability";
import { getProfile } from "@/app/_lib/dal";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { SortSelect, type SortOption } from "@/app/_components/sort-select";
import { strCmp } from "@/app/_lib/sort";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/app/_lib/format";
import { PROPERTY_TYPE_LABELS } from "@/app/_lib/types";
import { PropertyDialog } from "./_components/property-dialog";
import { listEntityOptions } from "@/app/_lib/data/entities";

export const metadata: Metadata = { title: "Propiedades" };

const BASE_OPTS: SortOption[] = [
  { value: "ocupacion_desc", label: "Ocupación (mayor a menor)" },
  { value: "ocupacion_asc", label: "Ocupación (menor a mayor)" },
  { value: "unidades_desc", label: "Número de unidades (mayor a menor)" },
  { value: "unidades_asc", label: "Número de unidades (menor a mayor)" },
  { value: "nombre_asc", label: "Nombre (A → Z)" },
  { value: "nombre_desc", label: "Nombre (Z → A)" },
];
const OWNER_OPTS: SortOption[] = [
  { value: "ingreso_desc", label: "Ingreso mensual (mayor a menor)" },
  { value: "ingreso_asc", label: "Ingreso mensual (menor a mayor)" },
  { value: "noi_desc", label: "NOI mensual (mayor a menor)" },
  { value: "noi_asc", label: "NOI mensual (menor a mayor)" },
  { value: "cap_desc", label: "Cap rate (mayor a menor)" },
  { value: "cap_asc", label: "Cap rate (menor a mayor)" },
  { value: "m2_desc", label: "Ingreso por m² (mayor a menor)" },
  { value: "m2_asc", label: "Ingreso por m² (menor a mayor)" },
  { value: "gasto_desc", label: "Gasto mensual (mayor a menor)" },
  { value: "gasto_asc", label: "Gasto mensual (menor a mayor)" },
  { value: "sincaptar_desc", label: "Ingreso potencial sin captar (mayor a menor)" },
  { value: "sincaptar_asc", label: "Ingreso potencial sin captar (menor a mayor)" },
  { value: "valor_desc", label: "Valor (mayor a menor)" },
  { value: "valor_asc", label: "Valor (menor a mayor)" },
];

type PropRow = Awaited<ReturnType<typeof listProperties>>[number];

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string }>;
}) {
  const sp = await searchParams;
  const [properties, entities, prof, profile] = await Promise.all([
    listProperties(),
    listEntityOptions(),
    getProfitability(),
    getProfile(),
  ]);
  const isOwner = profile?.role === "owner";
  const opts = isOwner ? [...OWNER_OPTS, ...BASE_OPTS] : BASE_OPTS;
  const orden = opts.some((o) => o.value === sp.orden) ? sp.orden! : isOwner ? "ingreso_desc" : "ocupacion_desc";

  const byProp = new Map<string, BuildingProfit>();
  for (const b of prof.buildings) byProp.set(b.property_id, b);
  const m = (p: PropRow) => byProp.get(p.id);
  const occ = (p: PropRow) => (p.unit_count > 0 ? p.occupied_count / p.unit_count : 0);
  const sincaptar = (p: PropRow) => {
    const b = m(p);
    return b ? Math.max(0, b.rentaPotencial - b.ingresoEsperado) : 0;
  };

  const sorted = [...properties].sort((a, b) => {
    switch (orden) {
      case "ocupacion_asc": return occ(a) - occ(b);
      case "ocupacion_desc": return occ(b) - occ(a);
      case "unidades_asc": return a.unit_count - b.unit_count;
      case "unidades_desc": return b.unit_count - a.unit_count;
      case "nombre_desc": return strCmp(b.name, a.name);
      case "nombre_asc": return strCmp(a.name, b.name);
      case "ingreso_asc": return (m(a)?.ingresoEsperado ?? 0) - (m(b)?.ingresoEsperado ?? 0);
      case "ingreso_desc": return (m(b)?.ingresoEsperado ?? 0) - (m(a)?.ingresoEsperado ?? 0);
      case "noi_asc": return (m(a)?.noi ?? 0) - (m(b)?.noi ?? 0);
      case "noi_desc": return (m(b)?.noi ?? 0) - (m(a)?.noi ?? 0);
      case "cap_asc": return (m(a)?.capRate ?? 0) - (m(b)?.capRate ?? 0);
      case "cap_desc": return (m(b)?.capRate ?? 0) - (m(a)?.capRate ?? 0);
      case "m2_asc": return (m(a)?.rentPerM2 ?? 0) - (m(b)?.rentPerM2 ?? 0);
      case "m2_desc": return (m(b)?.rentPerM2 ?? 0) - (m(a)?.rentPerM2 ?? 0);
      case "gasto_asc": return (m(a)?.gastos ?? 0) - (m(b)?.gastos ?? 0);
      case "gasto_desc": return (m(b)?.gastos ?? 0) - (m(a)?.gastos ?? 0);
      case "sincaptar_asc": return sincaptar(a) - sincaptar(b);
      case "sincaptar_desc": return sincaptar(b) - sincaptar(a);
      case "valor_asc": return (m(a)?.market_value ?? 0) - (m(b)?.market_value ?? 0);
      case "valor_desc": return (m(b)?.market_value ?? 0) - (m(a)?.market_value ?? 0);
      default: return isOwner ? (m(b)?.ingresoEsperado ?? 0) - (m(a)?.ingresoEsperado ?? 0) : occ(b) - occ(a);
    }
  });

  return (
    <>
      <PageHeader
        title="Propiedades"
        subtitle="Tus inmuebles y las unidades que rentas."
        action={<PropertyDialog entities={entities} />}
      />

      {properties.length > 0 && (
        <div className="mb-4">
          <SortSelect options={opts} current={orden} />
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin propiedades todavía"
          description="Registra tu primera propiedad y sus unidades para empezar."
          action={<PropertyDialog entities={entities} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <Link key={p.id} href={`/propiedades/${p.id}` as Route} className="block">
              <Card className="hover:border-foreground/20 h-full transition hover:shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="secondary">{PROPERTY_TYPE_LABELS[p.type]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-muted-foreground space-y-1.5 text-sm">
                  {(p.colonia || p.municipio) && (
                    <p className="flex items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" />
                      {[p.colonia, p.municipio].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p>
                    {p.unit_count} {p.unit_count === 1 ? "unidad" : "unidades"}
                    {p.unit_count > 0 &&
                      ` · ${p.occupied_count} ocupada${p.occupied_count === 1 ? "" : "s"}`}
                  </p>
                  {isOwner && m(p) && (
                    <p className="text-foreground font-medium">
                      Ingreso {formatMXN(m(p)!.ingresoEsperado)}/mes
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
