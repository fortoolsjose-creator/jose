import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { listMyRequests } from "@/app/_lib/data/requests";
import { getProfile } from "@/app/_lib/dal";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatus,
} from "@/app/_lib/types";
import { formatDate } from "@/app/_lib/format";
import { ReportDialog } from "./_components/report-dialog";

export const metadata: Metadata = { title: "Mis reportes" };

const STATUS_VARIANT: Record<MaintenanceStatus, "default" | "secondary" | "outline"> = {
  recibido: "secondary",
  en_proceso: "default",
  resuelto: "outline",
  cancelado: "outline",
};

export default async function MisReportesPage() {
  const [requests, profile] = await Promise.all([listMyRequests(), getProfile()]);
  const orgId = profile?.org_id ?? "";
  const userId = profile?.id ?? "";

  return (
    <>
      <PageHeader
        title="Mis reportes"
        subtitle="Los problemas que has reportado y cómo van."
        action={<ReportDialog orgId={orgId} userId={userId} />}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No has reportado nada todavía"
          description="Cuando algo falle en tu unidad, repórtalo y te avisamos en cuanto lo atendemos."
          action={<ReportDialog orgId={orgId} userId={userId} />}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Link key={r.id} href={`/mis-reportes/${r.id}` as Route} className="block">
              <Card className="hover:border-foreground/20 transition">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant={STATUS_VARIANT[r.status]}>
                        {MAINTENANCE_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {MAINTENANCE_CATEGORY_LABELS[r.category]} · {formatDate(r.created_at)}
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
