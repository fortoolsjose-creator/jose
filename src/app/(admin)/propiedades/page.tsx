import type { Metadata, Route } from "next";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { listProperties } from "@/app/_lib/data/properties";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_TYPE_LABELS } from "@/app/_lib/types";
import { PropertyDialog } from "./_components/property-dialog";
import { listEntityOptions } from "@/app/_lib/data/entities";

export const metadata: Metadata = { title: "Propiedades" };

export default async function PropiedadesPage() {
  const [properties, entities] = await Promise.all([
    listProperties(),
    listEntityOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Propiedades"
        subtitle="Tus inmuebles y las unidades que rentas."
        action={<PropertyDialog entities={entities} />}
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin propiedades todavía"
          description="Registra tu primera propiedad y sus unidades para empezar."
          action={<PropertyDialog entities={entities} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
