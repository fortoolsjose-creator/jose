import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getApplication } from "@/app/_lib/data/applications";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/app/_lib/format";
import {
  APPLICATION_STATUS_LABELS,
  GUARANTEE_TYPE_LABELS,
  type ApplicationStatus,
} from "@/app/_lib/types";
import { ApplicationStatusControl } from "../_components/application-status-control";
import { ConvertButton } from "../_components/convert-button";
import { DocButton } from "../_components/doc-button";

export const metadata: Metadata = { title: "Solicitud" };

const STATUS_VARIANT: Record<
  ApplicationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  recibida: "secondary",
  en_revision: "default",
  aprobada: "outline",
  rechazada: "destructive",
};

export default async function SolicitudDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const app = await getApplication(id);
  if (!app) notFound();

  const rows: [string, string][] = [
    ["Correo", app.applicant_email ?? "—"],
    ["Teléfono", app.applicant_phone ?? "—"],
    [
      "Ingreso mensual",
      app.monthly_income != null ? formatMXN(app.monthly_income) : "—",
    ],
    [
      "Garantía",
      app.guarantee_type ? GUARANTEE_TYPE_LABELS[app.guarantee_type] : "—",
    ],
    ["Recibida", formatDate(app.created_at)],
  ];

  const converted = app.status === "aprobada" || app.status === "rechazada";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={"/solicitudes" as Route}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Solicitudes
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{app.applicant_name}</h1>
        <Badge variant={STATUS_VARIANT[app.status]}>
          {APPLICATION_STATUS_LABELS[app.status]}
        </Badge>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        {[app.listing?.title, app.listing?.unit?.property?.name, app.listing?.unit?.label]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <Card className="mb-4">
        <CardContent className="py-0">
          <dl className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        {app.income_proof_url && (
          <DocButton path={app.income_proof_url} label="Comprobante de ingresos" />
        )}
        {app.id_doc_url && <DocButton path={app.id_doc_url} label="INE" />}
        {app.guarantee_doc_url && (
          <DocButton path={app.guarantee_doc_url} label="Garantía" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ApplicationStatusControl id={app.id} status={app.status} />
        <ConvertButton applicationId={app.id} disabled={converted} />
      </div>
    </div>
  );
}
