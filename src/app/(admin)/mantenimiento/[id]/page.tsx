import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequest } from "@/app/_lib/data/requests";
import { RequestTimeline } from "@/app/_components/request-timeline";
import { CommentForm } from "@/app/_components/comment-form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/app/_lib/format";
import {
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/app/_lib/types";
import { StatusControl } from "../_components/status-control";
import { addAdminComment } from "../actions";

export const metadata: Metadata = { title: "Reporte" };

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

export default async function RequestAdminDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { request, events } = await getRequest(id);
  if (!request) notFound();

  const meta = [
    request.unit?.property?.name,
    request.unit?.label,
    request.created_by_profile?.full_name ?? request.created_by_profile?.email,
    MAINTENANCE_CATEGORY_LABELS[request.category],
    formatDate(request.created_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/mantenimiento"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Mantenimiento
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
        <Badge variant={PRIORITY_VARIANT[request.priority]}>
          {MAINTENANCE_PRIORITY_LABELS[request.priority]}
        </Badge>
        <Badge variant={STATUS_VARIANT[request.status]}>
          {MAINTENANCE_STATUS_LABELS[request.status]}
        </Badge>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">{meta}</p>

      <div className="mb-6">
        <StatusControl requestId={request.id} status={request.status} />
      </div>

      {request.description && (
        <p className="bg-muted/40 mb-6 rounded-lg border p-3 text-sm">
          {request.description}
        </p>
      )}

      <h2 className="mb-3 text-lg font-semibold">Seguimiento</h2>
      <div className="mb-6">
        <RequestTimeline events={events} />
      </div>

      <CommentForm action={addAdminComment.bind(null, request.id)} />
    </div>
  );
}
