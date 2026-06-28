import type { Metadata } from "next";
import { AlertTriangle, HandCoins } from "lucide-react";
import { listWorkers } from "@/app/_lib/data/payroll";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { WorkerDialog } from "./_components/worker-dialog";
import { ConfirmDeleteButton } from "../propiedades/_components/confirm-delete-button";
import { deleteWorker } from "./actions";

export const metadata: Metadata = { title: "Nómina" };

export default async function NominaPage() {
  const workers = await listWorkers();

  return (
    <>
      <PageHeader
        title="Nómina"
        subtitle="Personal de operación (limpieza, mantenimiento, oficiales)."
        action={<WorkerDialog />}
      />

      <div className="text-muted-foreground bg-muted/50 mb-6 flex items-start gap-2 rounded-lg p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Estructura lista, pero <strong>faltan los datos reales de Magaly</strong>: la lista de
          personal, los montos por quincena y el formato de acuse (procesos #19, #21, #36). El
          registro de pagos con montos se conecta en cuanto los tengamos — no metimos cifras
          inventadas. Por ahora puedes ir capturando a las personas.
        </span>
      </div>

      {workers.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Sin personal capturado"
          description="Agrega a las personas a las que se les paga (limpieza, mantenimiento, etc.)."
          action={<WorkerDialog />}
        />
      ) : (
        <div className="space-y-3">
          {workers.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {[w.role, w.pay_frequency].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <ConfirmDeleteButton
                  onConfirm={deleteWorker.bind(null, w.id)}
                  title="¿Quitar persona?"
                  description={`Se quitará "${w.name}".`}
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
