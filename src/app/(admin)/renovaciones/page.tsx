import type { Metadata, Route } from "next";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { getRenewalCalendar, type RenewalRow } from "@/app/_lib/data/renewals";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN, formatDate } from "@/app/_lib/format";

export const metadata: Metadata = { title: "Renovaciones" };

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

export default async function RenovacionesPage() {
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
          description="Captura la vigencia en cada contrato (Inquilinos → un inquilino → Contrato) y aquí verás el calendario."
        />
      ) : (
        <>
          <Bucket
            title="Vencidos"
            subtitle="Ya pasó la fecha de renovación — atiéndelos primero."
            rows={cal.vencidos}
            tone="danger"
          />
          <Bucket
            title="Este mes"
            subtitle="Renuevan en los próximos 30 días."
            rows={cal.esteMes}
            tone="warn"
          />
          <Bucket
            title="Próximos (31–90 días)"
            subtitle="Para ir preparando la propuesta."
            rows={cal.proximos}
          />
          <Bucket
            title="Más adelante"
            subtitle="El resto del año."
            rows={cal.adelante}
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
