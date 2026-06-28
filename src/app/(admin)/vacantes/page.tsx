import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { listListings, listUnitsForListing } from "@/app/_lib/data/listings";
import { getProfile } from "@/app/_lib/dal";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/app/_lib/format";
import { LISTING_STATUS_LABELS, type ListingStatus } from "@/app/_lib/types";
import { ListingDialog } from "./_components/listing-dialog";
import { ListingRowActions } from "./_components/listing-row-actions";

export const metadata: Metadata = { title: "Vacantes" };

const STATUS_VARIANT: Record<ListingStatus, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  paused: "outline",
  filled: "outline",
};

export default async function VacantesPage() {
  const [profile, listings, units] = await Promise.all([
    getProfile(),
    listListings(),
    listUnitsForListing(),
  ]);

  const dialog = profile ? (
    <ListingDialog orgId={profile.org_id} units={units} />
  ) : null;

  return (
    <>
      <PageHeader
        title="Vacantes"
        subtitle="Publica unidades disponibles y comparte la liga para recibir solicitudes."
        action={dialog}
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin vacantes todavía"
          description="Publica una unidad disponible para empezar a recibir solicitudes."
          action={dialog}
        />
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.title}</span>
                    <Badge variant={STATUS_VARIANT[l.status]}>
                      {LISTING_STATUS_LABELS[l.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {[
                      l.unit?.property?.name,
                      l.unit?.label,
                      formatMXN(l.rent_amount),
                      `${l.application_count} solicitud${l.application_count === 1 ? "" : "es"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ListingRowActions id={l.id} slug={l.public_slug} status={l.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
