import type { Metadata } from "next";
import { getCompletions } from "@/app/_lib/data/process-tracker";
import { currentPeriod } from "@/app/_lib/data/finance";
import { isPeriodLocked } from "@/app/_lib/data/period-locks";
import { getProfile } from "@/app/_lib/dal";
import { createClient } from "@/app/_lib/supabase/server";
import { PROCESSES } from "@/app/_lib/processes";
import { PageHeader } from "@/app/_components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMonth } from "@/app/_lib/format";
import { ProcessChecklist } from "./_components/process-checklist";
import { LockButton } from "./_components/lock-button";

export const metadata: Metadata = { title: "Cierre de mes" };

export default async function CierreMesPage() {
  const period = currentPeriod();
  const [doneSet, profile, supabase] = await Promise.all([
    getCompletions(period),
    getProfile(),
    createClient(),
  ]);
  const locked = await isPeriodLocked(supabase, profile?.org_id ?? "", period);
  const isOwner = profile?.role === "owner";
  const done = [...doneSet];
  const total = PROCESSES.length;
  const pct = Math.round((done.length / total) * 100);

  return (
    <>
      <PageHeader
        title="Cierre de mes"
        subtitle={`Tus ${total} procesos del mes · ${formatMonth(period)}`}
      />

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Avance del mes</p>
              <p className="text-lg font-bold">
                {done.length} / {total} procesos ({pct}%){" "}
                {locked && <Badge variant="secondary">Cerrado</Badge>}
              </p>
            </div>
            <LockButton period={period} locked={locked} isOwner={isOwner} />
          </div>
          <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
          {locked && (
            <p className="text-muted-foreground mt-2 text-xs">
              Este mes está cerrado: no se pueden registrar ni editar gastos/cobros de{" "}
              {formatMonth(period)} hasta que el dueño lo reabra.
            </p>
          )}
        </CardContent>
      </Card>

      <ProcessChecklist period={period} done={done} />
    </>
  );
}
