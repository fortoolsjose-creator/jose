import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { listLeasesWithMetrics, listVacantUnits, type LeaseRowFull } from "@/app/_lib/data/leases";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { SortSelect, type SortOption } from "@/app/_components/sort-select";
import { dateAsc, dateDesc, strCmp } from "@/app/_lib/sort";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/app/_lib/format";
import { LEASE_STATUS_LABELS, type LeaseStatus } from "@/app/_lib/types";
import { LeaseDialog } from "./_components/lease-dialog";

export const metadata: Metadata = { title: "Arrendatarios" };

const STATUS_VARIANT: Record<LeaseStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  ended: "outline",
};

const OPTS: SortOption[] = [
  { value: "saldo_desc", label: "Saldo vencido (mayor a menor)" },
  { value: "saldo_asc", label: "Saldo vencido (menor a mayor)" },
  { value: "ingreso_desc", label: "Ingreso mensual (mayor a menor)" },
  { value: "ingreso_asc", label: "Ingreso mensual (menor a mayor)" },
  { value: "atraso_desc", label: "Días de atraso (mayor a menor)" },
  { value: "atraso_asc", label: "Días de atraso (menor a mayor)" },
  { value: "punt_desc", label: "Puntualidad (mayor a menor)" },
  { value: "punt_asc", label: "Puntualidad (menor a mayor)" },
  { value: "vence_asc", label: "Vencimiento de contrato (más próximo)" },
  { value: "vence_desc", label: "Vencimiento de contrato (más lejano)" },
  { value: "poliza_asc", label: "Vencimiento de garantía (más próximo)" },
  { value: "poliza_desc", label: "Vencimiento de garantía (más lejano)" },
  { value: "inicio_desc", label: "Antigüedad del contrato (más reciente)" },
  { value: "inicio_asc", label: "Antigüedad del contrato (más antiguo)" },
  { value: "pct_desc", label: "Participación en el ingreso (mayor a menor)" },
  { value: "pct_asc", label: "Participación en el ingreso (menor a mayor)" },
  { value: "nombre_asc", label: "Nombre (A → Z)" },
  { value: "nombre_desc", label: "Nombre (Z → A)" },
];

function sortLeases(rows: LeaseRowFull[], orden: string): LeaseRowFull[] {
  const r = [...rows];
  const name = (l: LeaseRowFull) => l.tenant?.full_name ?? l.tenant?.email ?? "";
  switch (orden) {
    case "saldo_asc": return r.sort((a, b) => a.saldoVencido - b.saldoVencido);
    case "ingreso_desc": return r.sort((a, b) => b.ingreso - a.ingreso);
    case "ingreso_asc": return r.sort((a, b) => a.ingreso - b.ingreso);
    case "atraso_desc": return r.sort((a, b) => b.diasAtraso - a.diasAtraso);
    case "atraso_asc": return r.sort((a, b) => a.diasAtraso - b.diasAtraso);
    case "punt_desc": return r.sort((a, b) => b.puntualidad - a.puntualidad);
    case "punt_asc": return r.sort((a, b) => a.puntualidad - b.puntualidad);
    case "vence_asc": return r.sort((a, b) => dateAsc(a.end_date, b.end_date));
    case "vence_desc": return r.sort((a, b) => dateDesc(a.end_date, b.end_date));
    case "poliza_asc": return r.sort((a, b) => dateAsc(a.poliza_vigencia, b.poliza_vigencia));
    case "poliza_desc": return r.sort((a, b) => dateDesc(a.poliza_vigencia, b.poliza_vigencia));
    case "inicio_desc": return r.sort((a, b) => dateDesc(a.start_date, b.start_date));
    case "inicio_asc": return r.sort((a, b) => dateAsc(a.start_date, b.start_date));
    case "pct_desc": return r.sort((a, b) => b.pctIngreso - a.pctIngreso);
    case "pct_asc": return r.sort((a, b) => a.pctIngreso - b.pctIngreso);
    case "nombre_asc": return r.sort((a, b) => strCmp(name(a), name(b)));
    case "nombre_desc": return r.sort((a, b) => strCmp(name(b), name(a)));
    default: return r.sort((a, b) => b.saldoVencido - a.saldoVencido);
  }
}

export default async function ArrendatariosPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string }>;
}) {
  const sp = await searchParams;
  const orden = OPTS.some((o) => o.value === sp.orden) ? sp.orden! : "saldo_desc";
  const [leasesRaw, vacantUnits] = await Promise.all([listLeasesWithMetrics(), listVacantUnits()]);
  const leases = sortLeases(leasesRaw, orden);

  return (
    <>
      <PageHeader
        title="Arrendatarios"
        subtitle="Contratos y las personas que rentan tus unidades."
        action={<LeaseDialog vacantUnits={vacantUnits} />}
      />

      {leases.length > 0 && (
        <div className="mb-4">
          <SortSelect options={OPTS} current={orden} />
        </div>
      )}

      {leases.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin contratos todavía"
          description="Crea un contrato para invitar a un arrendatario y darle acceso a su portal."
          action={<LeaseDialog vacantUnits={vacantUnits} />}
        />
      ) : (
        <div className="space-y-3">
          {leases.map((l) => (
            <Link key={l.id} href={`/inquilinos/${l.id}` as Route} className="block">
              <Card className="hover:border-foreground/20 transition">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {l.tenant?.full_name ?? l.tenant?.email ?? "Arrendatario"}
                      </span>
                      <Badge variant={STATUS_VARIANT[l.status]}>
                        {LEASE_STATUS_LABELS[l.status]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[
                        l.unit?.property?.name,
                        l.unit?.label,
                        `Ingreso ${formatMXN(l.ingreso)}`,
                        l.end_date ? `vence ${formatDate(l.end_date)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {l.saldoVencido > 0 && (
                      <p className="text-destructive text-xs font-medium">
                        Saldo vencido {formatMXN(l.saldoVencido)} · {l.diasAtraso} días
                      </p>
                    )}
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
