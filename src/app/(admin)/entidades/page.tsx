import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { getProfile } from "@/app/_lib/dal";
import { listEntities } from "@/app/_lib/data/entities";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "../propiedades/_components/confirm-delete-button";
import { EntityDialog } from "./_components/entity-dialog";
import { deleteEntity } from "./actions";

export const metadata: Metadata = { title: "Sociedades" };

export default async function EntidadesPage() {
  const profile = await getProfile();
  if (profile?.role !== "owner") redirect("/panel");
  const entities = await listEntities();

  return (
    <>
      <PageHeader
        title="Sociedades"
        subtitle="Las razones sociales del negocio (CIT, PH, SPH, CIMMA). Asigna cada edificio a la suya en Propiedades → Editar."
        action={<EntityDialog />}
      />

      {entities.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin sociedades"
          description="Crea tus razones sociales para empezar a clasificar los edificios por entidad."
        />
      ) : (
        <div className="space-y-3">
          {entities.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{e.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {[
                      e.rfc,
                      e.regimen,
                      `${e.propertyCount} ${e.propertyCount === 1 ? "edificio" : "edificios"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ConfirmDeleteButton
                  onConfirm={deleteEntity.bind(null, e.id)}
                  title="¿Eliminar sociedad?"
                  description={`Se quitará "${e.nombre}". Los edificios quedan sin sociedad asignada.`}
                  triggerLabel=""
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
