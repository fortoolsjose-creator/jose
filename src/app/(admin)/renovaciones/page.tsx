import type { Metadata, Route } from "next";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { getRenewalCalendar, type RenewalRow } from "@/app/_lib/data/renewals";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { SortSelect, type SortOption } from "@/app/_components/sort-select";
import { dateAsc, dateDesc } from "@/app/_lib/sort";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN, formatDate } from "@/app/_lib/format";

export const metadata: Metadata = { title: "Renovaciones" };

const OPTS: SortOption[] = [
  { value: "vence_asc", label: "Vencimiento (más próximo)" },
  { value: "vence_desc", label: "Vencimiento (más lejano)" },
  { value: "ingreso_desc", label: "Ingreso del contrato (mayor a menor)" },
  { value: "ingreso_asc", label: "Ingreso del contrato (menor a mayor)" },
  { value: "antiguedad_desc", label: "Antigüedad del contrato (más reciente)" },
  { value: "antiguedad_asc", label: "Antigüedad del contrato (más antiguo)" },
];

function sortRows(rows: RenewalRow[], orden: string): RenewalRow[] {
  const r = [...rows];
  switch (orden) {
    case "vence_desc": return r.sort((a, b) => dateDesc(a.end_date, b.end_date));
    case "ingreso_desc": return r.sort((a, b) => b.ingreso - a.ingreso);
    case "ingreso_asc": return r.sort((a, b) => a.ingreso - b.ingreso);
    case "antiguedad_desc": return r.sort((a, b) => dateDesc(a.start_date, b.start_date));
    case "antiguedad_asc": return r.sort((a, b) => dateAsc(a.start_date, b.start_date));
    default: return r.sort((a, b) => dateAsc(a.end_date, b.end_date));
  }
}

function Bucket({
  title,
  subtitle,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: RenewalRow[];
  tone?: "danger" | "warn";
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-muted-foreground text-sm font-normal">· {rows.length}</span>
      </h2>
      <p className="text-muted-foreground mb-3 text-sm">{subtitle}</p>
      <Card>
        <CardContent className="px-0 py-0">
          <div className="divide-y text-sm">
            {rows.map((r) => (
              <Link key={r.lease_id} href={`/inquilinos/${r.lease_id}` as Route} className="block">
                <div className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-2.5 transition-colors">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.tenant}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {r.unit} · {formatMXN(r.rent)}/mes
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <div>
                      <p className="text-sm">{formatDate(r.end_date)}</p>
                      <p
                        className={`text-xs ${tone === "danger" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {r.dias < 0 ? `hace ${Math.abs(r.dias)} días` : `en ${r.dias} días`}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground size-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default async function RenovacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string }>;
}) {
  const sp = await searchParams;
  const orden = OPTS.some((o) => o.value === sp.orden) ? sp.orden! : "vence_asc";
  const cal = await getRenewalCalendar();
  const conFecha = cal.total - cal.sinFecha;

  return (
    <>
      <PageHeader
        title="Renovaciones"
        subtitle="Qué contratos renuevan y cuándo. Toca uno para abrir su calculadora."
      />

      {conFecha === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Sin fechas de renovación capturadas"
          description="Captura la vigencia en cada contrato (Arrendatarios → un arrendatario → Contrato) y aquí verás el calendario."
        />
      ) : (
        <>
          <div className="mb-4">
            <SortSelect options={OPTS} current={orden} />
          </div>
          <Bucket
            title="Vencidos"
            subtitle="Ya pasó la fecha de renovación — atiéndelos primero."
            rows={sortRows(cal.vencidos, orden)}
            tone="danger"
          />
          <Bucket
            title="Este mes"
            subtitle="Renuevan en los próximos 30 días."
            rows={sortRows(cal.esteMes, orden)}
            tone="warn"
          />
          <Bucket
            title="Próximos (31–90 días)"
            subtitle="Para ir preparando la propuesta."
            rows={sortRows(cal.proximos, orden)}
          />
          <Bucket
            title="Más adelante"
            subtitle="El resto del año."
            rows={sortRows(cal.adelante, orden)}
          />
        </>
      )}

      {cal.sinFecha > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          {cal.sinFecha} contrato{cal.sinFecha === 1 ? "" : "s"} sin fecha de renovación capturada
          (no aparecen arriba).
        </p>
      )}
    </>
  );
}
