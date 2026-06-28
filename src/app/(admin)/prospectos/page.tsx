import type { Metadata } from "next";
import { Users } from "lucide-react";
import { listProspects } from "@/app/_lib/data/prospects";
import { listProperties } from "@/app/_lib/data/properties";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { PROSPECT_STAGE_LABELS, type ProspectStage } from "@/app/_lib/types";
import { ProspectCard } from "./_components/prospect-card";
import { ProspectDialog } from "./_components/prospect-dialog";

export const metadata: Metadata = { title: "Prospectos" };

const ORDER: ProspectStage[] = ["prospecto", "evaluacion", "aprobado", "papeleo", "cliente", "rechazado"];

export default async function ProspectosPage() {
  const [prospects, allProps] = await Promise.all([listProspects(), listProperties()]);
  const properties = allProps.map((p) => ({ id: p.id, name: p.name }));

  const byStage = new Map<ProspectStage, typeof prospects>();
  for (const p of prospects) {
    const arr = byStage.get(p.stage) ?? [];
    arr.push(p);
    byStage.set(p.stage, arr);
  }

  return (
    <>
      <PageHeader
        title="Prospectos"
        subtitle="Pipeline de inquilinos: del prospecto al cliente, con evaluación de riesgo."
        action={<ProspectDialog properties={properties} />}
      />

      <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> Ingreso ≥3× + garantía</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> Aceptable</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-500" /> Riesgo</span>
      </div>

      {prospects.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin prospectos"
          description="Agrega un prospecto y muévelo por el pipeline: prospecto → evaluación → aprobado → papeleo → cliente."
        />
      ) : (
        <div className="space-y-7">
          {ORDER.map((stage) => {
            const items = byStage.get(stage) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={stage}>
                <h2 className="mb-3 text-lg font-semibold">
                  {PROSPECT_STAGE_LABELS[stage]}{" "}
                  <span className="text-muted-foreground text-sm font-normal">· {items.length}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <ProspectCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
