import type { Metadata, Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatMonth } from "@/app/_lib/format";
import { ensureCurrentPayments } from "@/app/_lib/data/payments";
import { getCollectionSummary, listDebtors } from "@/app/_lib/data/finance";
import { getProfitability, getPatrimonio } from "@/app/_lib/data/profitability";
import { getProfile } from "@/app/_lib/dal";
import { getUpcomingExpirations } from "@/app/_lib/data/reports";
import { listRequestsAdmin } from "@/app/_lib/data/requests";
import {
  MAINTENANCE_PRIORITY_LABELS,
  type MaintenancePriority,
} from "@/app/_lib/types";

export const metadata: Metadata = { title: "Inicio" };

const PRIORITY_VARIANT: Record<
  MaintenancePriority,
  "default" | "secondary" | "outline" | "destructive"
> = {
  urgente: "destructive",
  alta: "default",
  media: "secondary",
  baja: "outline",
};

function MiniStat({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Apodo para el saludo: Genaro → "G", Adriana → "Adri", si no el primer nombre. */
function saludoNombre(profile: { full_name: string | null; email: string | null } | null): string {
  const email = (profile?.email ?? "").toLowerCase();
  const full = (profile?.full_name ?? "").toLowerCase();
  if (email.startsWith("genaro") || full.includes("genaro")) return "G";
  if (email.startsWith("adriana") || full.includes("adriana")) return "Adri";
  return (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
}

export default async function PanelPage() {
  await ensureCurrentPayments();
  const [sum, prof, patr, expirations, debtors, requests, profile] = await Promise.all([
    getCollectionSummary(),
    getProfitability(),
    getPatrimonio(),
    getUpcomingExpirations(60),
    listDebtors(),
    listRequestsAdmin({}),
    getProfile(),
  ]);
  const isOwner = profile?.role === "owner";
  const nombre = saludoNombre(profile);

  const esperado = sum.cobrado + sum.porCobrar;
  const sinCaptar = Math.max(0, prof.totals.rentaPotencial - prof.totals.ingresoEsperado);
  const pct = Math.round(sum.pctCobranza * 100);

  const atencion = [
    ...expirations.slice(0, 3).map((e) => ({
      key: `exp-${e.lease_id}`,
      href: `/inquilinos/${e.lease_id}` as Route,
      icon: CalendarClock,
      warn: e.dias <= 30,
      danger: false,
      title: `Vence pronto: ${e.tenant}`,
      sub: `${e.unit} · en ${e.dias} días`,
    })),
    ...debtors.slice(0, 3).map((d) => ({
      key: `deb-${d.lease_id}`,
      href: `/inquilinos/${d.lease_id}` as Route,
      icon: AlertTriangle,
      warn: false,
      danger: true,
      title: `${d.tenant} debe ${formatMXN(d.saldoVencido)}`,
      sub: `${d.unit} · ${d.diasAtraso} días`,
    })),
  ];

  const open = requests
    .filter((r) => r.status === "recibido" || r.status === "en_proceso")
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={nombre ? `Hola ${nombre}` : "Inicio"}
        subtitle={`Cómo va tu mes · ${formatMonth(sum.period)}`}
      />

      <Card className="mb-4">
        <CardContent className="py-5">
          {sum.cobrado > 0 ? (
            <>
              <p className="text-muted-foreground text-sm">Entró este mes</p>
              <p className="text-3xl font-bold">
                {formatMXN(sum.cobrado)}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  de {formatMXN(esperado)}
                </span>
              </p>
              <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">{pct}% cobrado</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">Por cobrar este mes</p>
              <p className="text-3xl font-bold">{formatMXN(esperado)}</p>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Aún no registras cobros de {formatMonth(sum.period)}. Regístralos en Cobros
                conforme entren y aquí verás cuánto llevas.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat
          label="Te deben"
          value={formatMXN(sum.vencidoTotal)}
          hint={sum.deudores === 0 ? "Nadie atrasado" : `${sum.deudores} con atraso`}
          danger={sum.vencidoTotal > 0}
        />
        <MiniStat
          label="Sin captar / mes"
          value={formatMXN(sinCaptar)}
          hint="Renta vacía o bajo mercado"
          danger={sinCaptar > 0}
        />
        {isOwner && (
          <MiniStat
            label="Tu patrimonio"
            value={patr.valuedCount > 0 ? formatMXN(patr.valor) : "—"}
            hint={
              patr.valuedCount > 0
                ? `${patr.valuedCount} de ${patr.total} valuadas${patr.plusvalia != null ? ` · +${Math.round(patr.plusvalia * 100)}%` : ""}`
                : "Agrega valores en Propiedades"
            }
          />
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Necesita tu atención</h2>
        {atencion.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Todo en orden"
            description="Sin vencimientos próximos ni atrasos."
          />
        ) : (
          <div className="space-y-2">
            {atencion.map((a) => (
              <Link key={a.key} href={a.href} className="block">
                <Card className="hover:border-foreground/20 transition">
                  <CardContent className="flex items-center gap-3 py-3">
                    <a.icon
                      className={`size-4 shrink-0 ${a.danger ? "text-destructive" : a.warn ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{a.sub}</p>
                    </div>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reportes por atender</h2>
          {requests.length > 0 && (
            <Link
              href="/mantenimiento"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              Ver todos
            </Link>
          )}
        </div>

        {open.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Todo tranquilo"
            description="No hay reportes pendientes. Cuando llegue uno, aparecerá aquí."
          />
        ) : (
          <div className="space-y-2">
            {open.map((r) => (
              <Link key={r.id} href={`/mantenimiento/${r.id}` as Route} className="block">
                <Card className="hover:border-foreground/20 transition">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{r.title}</span>
                      <Badge variant={PRIORITY_VARIANT[r.priority]}>
                        {MAINTENANCE_PRIORITY_LABELS[r.priority]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm">
                      <span className="hidden sm:inline">{r.unit?.property?.name}</span>
                      <ChevronRight className="size-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
