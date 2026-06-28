import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { listProviders } from "@/app/_lib/data/providers";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderDialog } from "./_components/provider-dialog";
import { ConfirmDeleteButton } from "../propiedades/_components/confirm-delete-button";
import { deleteProvider } from "./actions";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  const providers = await listProviders();

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle="Directorio de proveedores y con qué frecuencia los usas."
        action={<ProviderDialog />}
      />

      {providers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Sin proveedores"
          description="Agrega los proveedores que usas (plomería, limpieza, electricidad…)."
          action={<ProviderDialog />}
        />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {[p.service_type, p.phone, p.email].filter(Boolean).join(" · ") ||
                      "Sin datos de contacto"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {p.usos > 0 && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {p.usos} {p.usos === 1 ? "gasto" : "gastos"}
                    </span>
                  )}
                  <ConfirmDeleteButton
                    onConfirm={deleteProvider.bind(null, p.id)}
                    title="¿Eliminar proveedor?"
                    description={`Se quitará "${p.name}".`}
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
