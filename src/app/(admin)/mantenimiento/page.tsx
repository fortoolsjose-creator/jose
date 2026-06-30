import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronRight, Wrench, CalendarClock } from "lucide-react";
import { listRequestsAdmin } from "@/app/_lib/data/requests";
import { ensureDuePreventive, listPlans } from "@/app/_lib/data/maintenance-plans";
import { listProperties, listUnitsFlat } from "@/app/_lib/data/properties";
import { getMaintenanceMonth } from "@/app/_lib/data/maintenance-month";
import { listWorkers } from "@/app/_lib/data/payroll";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { SortSelect, type SortOption } from "@/app/_components/sort-select";
import { dateAsc, dateDesc } from "@/app/_lib/sort";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMXN, formatMonth } from "@/app/_lib/format";
import { RegistrarMttoDialog } from "./_components/registrar-mtto-dialog";
import {
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/app/_lib/types";
import { ConfirmDeleteButton } from "@/app/(admin)/propiedades/_components/confirm-delete-button";
import { RequestFilters } from "./_components/request-filters";
import { PlanDialog } from "./_components/plan-dialog";
import { deletePlan } from "./actions";

export const metadata: Metadata = { title: "Mantenimiento" };

const PRIORITY_VARIANT: Record<
  MaintenancePriority,
  "default" | "secondary" | "outline" | "destructive"
> = {
  urgente: "destructive",
  alta: "default",
  media: "secondary",
  baja: "outline",
};

const STATUS_VARIANT: Record<MaintenanceStatus, "default" | "secondary" | "outline"> = {
  recibido: "secondary",
  en_proceso: "default",
  resuelto: "outline",
  cancelado: "outline",
};

const OPTS: SortOption[] = [
  { value: "prioridad_desc", label: "Prioridad (mayor a menor)" },
  { value: "prioridad_asc", label: "Prioridad (menor a mayor)" },
  { value: "tiempo_desc", label: "Tiempo abierto (mayor a menor)" },
  { value: "tiempo_asc", label: "Tiempo abierto (menor a mayor)" },
  { value: "costo_desc", label: "Costo (mayor a menor)" },
  { value: "costo_asc", label: "Costo (menor a mayor)" },
  { value: "estado", label: "Estado (pendientes primero)" },
];
const PRIO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
const ST: Record<string, number> = { recibido: 0, en_proceso: 1, resuelto: 2, cancelado: 3 };

export default async function MantenimientoPage(props: {
  searchParams: Promise<{ status?: string; orden?: string }>;
}) {
  const sp = await props.searchParams;
  await ensureDuePreventive();
  const orden = OPTS.some((o) => o.value === sp.orden) ? sp.orden! : "prioridad_desc";
  const [requestsRaw, plans, allProps, mes, workers, units] = await Promise.all([
    listRequestsAdmin({ status: sp.status }),
    listPlans(),
    listProperties(),
    getMaintenanceMonth(),
    listWorkers(),
    listUnitsFlat(),
  ]);
  const requests = [...requestsRaw].sort((a, b) => {
    const cost = (r: (typeof requestsRaw)[number]) => Number(r.cost ?? 0);
    switch (orden) {
      case "prioridad_asc": return (PRIO[b.priority] ?? 9) - (PRIO[a.priority] ?? 9);
      case "tiempo_desc": return dateAsc(a.created_at, b.created_at);
      case "tiempo_asc": return dateDesc(a.created_at, b.created_at);
      case "costo_desc": return cost(b) - cost(a);
      case "costo_asc": return cost(a) - cost(b);
      case "estado": return (ST[a.status] ?? 9) - (ST[b.status] ?? 9);
      default: return (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9);
    }
  });
  const properties = allProps.map((p) => ({ id: p.id, name: p.name }));
  const workerOpts = workers.map((w) => ({ id: w.id, name: w.name }));

  return (
    <>
      <PageHeader
        title="Mantenimiento"
        subtitle="Lo que se hizo en el mes, planes preventivos y reportes."
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Mantenimiento del mes{" "}
            <span className="text-muted-foreground text-sm font-normal">· {formatMonth(mes.period)}</span>
          </h2>
          <RegistrarMttoDialog properties={properties} units={units} workers={workerOpts} />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Hechos</p>
            <p className="text-lg font-bold">{mes.total}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Preventivos</p>
            <p className="text-lg font-bold">{mes.preventivo}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Correctivos</p>
            <p className="text-lg font-bold">{mes.correctivo}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Costo del mes</p>
            <p className="text-lg font-bold">{formatMXN(mes.totalCost)}</p>
          </CardContent></Card>
        </div>
        {mes.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no registras mantenimientos este mes. Usa «Registrar mantenimiento» para anotar lo
            que se hizo — con quién lo hizo y cuánto costó.
          </p>
        ) : (
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              {mes.rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant={r.tipo === "preventivo" ? "outline" : "secondary"}>
                        {MAINTENANCE_TYPE_LABELS[r.tipo]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {[r.unit, r.quien && `por ${r.quien}`, formatDate(r.fecha)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {r.cost > 0 && <span className="shrink-0 font-medium">{formatMXN(r.cost)}</span>}
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Planes preventivos</h2>
          <PlanDialog properties={properties} />
        </div>
        {plans.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Sin planes todavía. Crea uno (ej. «Fumigación cada 3 meses») y la plataforma
            generará el ticket solo en su fecha.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((pl) => (
              <Card key={pl.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pl.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {[
                          pl.property?.name,
                          `cada ${pl.frequency_months} ${pl.frequency_months === 1 ? "mes" : "meses"}`,
                          `próx. ${formatDate(pl.next_due)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <ConfirmDeleteButton
                    onConfirm={deletePlan.bind(null, pl.id)}
                    title="¿Quitar plan?"
                    description={`Se desactiva «${pl.title}».`}
                    triggerLabel=""
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-3 text-lg font-semibold">Reportes</h2>
      <div className="mb-4 space-y-3">
        <RequestFilters />
        {requests.length > 0 && <SortSelect options={OPTS} current={orden} />}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Sin reportes"
          description="Cuando un arrendatario reporte un problema (o se genere un preventivo), aparecerá aquí."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Link key={r.id} href={`/mantenimiento/${r.id}` as Route} className="block">
              <Card className="hover:border-foreground/20 transition">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant={r.mtype === "preventivo" ? "outline" : "secondary"}>
                        {MAINTENANCE_TYPE_LABELS[r.mtype]}
                      </Badge>
                      <Badge variant={PRIORITY_VARIANT[r.priority]}>
                        {MAINTENANCE_PRIORITY_LABELS[r.priority]}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[r.status]}>
                        {MAINTENANCE_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[
                        r.unit?.property?.name,
                        r.unit?.label,
                        r.created_by_profile?.full_name,
                        MAINTENANCE_CATEGORY_LABELS[r.category],
                        formatDate(r.created_at),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
