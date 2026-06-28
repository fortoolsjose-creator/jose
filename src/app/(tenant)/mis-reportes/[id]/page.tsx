import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequest } from "@/app/_lib/data/requests";
import { createClient } from "@/app/_lib/supabase/server";
import { RequestTimeline } from "@/app/_components/request-timeline";
import { StatusStepper } from "@/app/_components/status-stepper";
import { CommentForm } from "@/app/_components/comment-form";
import { MAINTENANCE_CATEGORY_LABELS } from "@/app/_lib/types";
import { formatDate } from "@/app/_lib/format";
import { addTenantComment } from "../actions";
import { TenantRating } from "../_components/tenant-rating";

export const metadata: Metadata = { title: "Reporte" };

export default async function ReporteDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { request, events } = await getRequest(id);
  if (!request) notFound();

  let yaCalifico = false;
  if (request.status === "resuelto") {
    const supabase = await createClient();
    const { data: rating } = await supabase
      .from("satisfaction_ratings")
      .select("id")
      .eq("request_id", id)
      .limit(1)
      .maybeSingle();
    yaCalifico = !!rating;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/mis-reportes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Mis reportes
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {MAINTENANCE_CATEGORY_LABELS[request.category]} · {formatDate(request.created_at)}
      </p>

      <div className="mb-6">
        <StatusStepper status={request.status} />
      </div>

      {request.description && (
        <p className="bg-muted/40 mb-6 rounded-lg border p-3 text-sm">
          {request.description}
        </p>
      )}

      {request.status === "resuelto" && !yaCalifico && (
        <div className="mb-6">
          <TenantRating requestId={request.id} />
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Seguimiento</h2>
      <div className="mb-6">
        <RequestTimeline events={events} />
      </div>

      <CommentForm
        action={addTenantComment.bind(null, request.id)}
        placeholder="Escribe un mensaje para tu arrendador…"
      />
    </div>
  );
}
