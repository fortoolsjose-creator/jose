import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { listApplications } from "@/app/_lib/data/applications";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMXN } from "@/app/_lib/format";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/app/_lib/types";
import { ApplicationFilters } from "./_components/application-filters";

export const metadata: Metadata = { title: "Solicitudes" };

const STATUS_VARIANT: Record<
  ApplicationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  recibida: "secondary",
  en_revision: "default",
  aprobada: "outline",
  rechazada: "destructive",
};

export default async function SolicitudesPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await props.searchParams;
  const apps = await listApplications({ status: sp.status });

  return (
    <>
      <PageHeader
        title="Solicitudes"
        subtitle="Personas que quieren rentar tus vacantes."
      />

      <div className="mb-4">
        <ApplicationFilters />
      </div>

      {apps.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin solicitudes"
          description="Cuando alguien solicite una de tus vacantes publicadas, aparecerá aquí."
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/solicitudes/${a.id}` as Route} className="block">
              <Card className="hover:border-foreground/20 transition">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.applicant_name}</span>
                      <Badge variant={STATUS_VARIANT[a.status]}>
                        {APPLICATION_STATUS_LABELS[a.status]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[
                        a.listing?.title,
                        a.listing?.unit?.label,
                        a.monthly_income != null &&
                          `ingreso ${formatMXN(a.monthly_income)}`,
                        formatDate(a.created_at),
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
