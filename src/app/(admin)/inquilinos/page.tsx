import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { listLeases, listVacantUnits } from "@/app/_lib/data/leases";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/app/_lib/format";
import { LEASE_STATUS_LABELS, type LeaseStatus } from "@/app/_lib/types";
import { LeaseDialog } from "./_components/lease-dialog";

export const metadata: Metadata = { title: "Inquilinos" };

const STATUS_VARIANT: Record<LeaseStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  ended: "outline",
};

export default async function InquilinosPage() {
  const [leases, vacantUnits] = await Promise.all([
    listLeases(),
    listVacantUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Inquilinos"
        subtitle="Contratos y las personas que rentan tus unidades."
        action={<LeaseDialog vacantUnits={vacantUnits} />}
      />

      {leases.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin contratos todavía"
          description="Crea un contrato para invitar a un inquilino y darle acceso a su portal."
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
                        {l.tenant?.full_name ?? l.tenant?.email ?? "Inquilino"}
                      </span>
                      <Badge variant={STATUS_VARIANT[l.status]}>
                        {LEASE_STATUS_LABELS[l.status]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[
                        l.unit?.property?.name,
                        l.unit?.label,
                        `Renta ${formatMXN(l.rent_amount)}`,
                        `día ${l.payment_day}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {(l.tenant?.email || l.tenant?.phone) && (
                      <p className="text-muted-foreground text-xs">
                        {[l.tenant?.email, l.tenant?.phone].filter(Boolean).join(" · ")}
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
