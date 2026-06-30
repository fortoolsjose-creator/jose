import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getProfitability } from "@/app/_lib/data/profitability";
import { listDebtors, currentPeriod } from "@/app/_lib/data/finance";
import { getProfile } from "@/app/_lib/dal";
import { getOperatingFund } from "@/app/_lib/data/operating-fund";
import {
  getPaymentReport,
  getExpenseReport,
  getMonthlyTrend,
  getCollectionAging,
  getUpcomingExpirations,
  getConcentration,
  getMarketPriceReport,
  getCashVsTransfer,
  getCashForecast,
  getTopTenants,
  getSatisfactionSummary,
} from "@/app/_lib/data/reports";
import { PageHeader } from "@/app/_components/page-header";
import { ExportButton } from "./_components/export-button";
import { PeriodSelector } from "./_components/period-selector";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/app/_lib/types";

export const metadata: Metadata = { title: "Reportes" };

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-muted-foreground mb-3 text-sm">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const period0 = /^\d{4}-\d{2}$/.test(sp.periodo ?? "") ? `${sp.periodo}-01` : currentPeriod();
  const [py, pmonth] = period0.slice(0, 7).split("-").map(Number);
  const prevD = new Date(py, pmonth - 2, 1);
  const prevPeriod = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ period, buildings, totals }, debtors, pay, exp, prevExp, trend, aging, expirations, conc, market, opFund, cash] =
    await Promise.all([
      getProfitability(period0),
      listDebtors(),
      getPaymentReport(),
      getExpenseReport(period0),
      getExpenseReport(prevPeriod),
      getMonthlyTrend(6),
      getCollectionAging(),
      getUpcomingExpirations(90),
      getConcentration(),
      getMarketPriceReport(),
      getOperatingFund(),
      getCashVsTransfer(period0),
    ]);
  const gastosDelta = exp.total - prevExp.total;
  const gastosPct = prevExp.total > 0 ? gastosDelta / prevExp.total : null;
  const profile = await getProfile();
  const isOwner = profile?.role === "owner";
  const [forecast, topTenants, satis] = isOwner
    ? await Promise.all([getCashForecast(6), getTopTenants(5), getSatisfactionSummary()])
    : [[], { tenants: [], total: 0 }, { avg: 0, count: 0 }];
  const forecastMax = Math.max(1, ...forecast.map((m) => m.esperado + m.enRiesgo));
  const trendMax = Math.max(1, ...trend.map((m) => m.facturado));
  const expenseRatio = totals.ingresoEsperado > 0 ? totals.gastos / totals.ingresoEsperado : 0;
  const topBuilding = buildings.reduce<(typeof buildings)[number] | null>(
    (top, b) => (!top || b.ingresoEsperado > top.ingresoEsperado ? b : top),
    null,
  );
  const topBuildingPct =
    topBuilding && totals.ingresoEsperado > 0
      ? topBuilding.ingresoEsperado / totals.ingresoEsperado
      : 0;

  const ranking = [...buildings].sort((a, b) => {
    if (a.capRate == null && b.capRate == null) return b.noi - a.noi;
    if (a.capRate == null) return 1;
    if (b.capRate == null) return -1;
    return b.capRate - a.capRate;
  });
  const carteraTotal = debtors.reduce((s, d) => s + d.saldoVencido, 0);

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={`Tu tablero de control · ${formatMonth(period)}`}
        action={isOwner ? <ExportButton /> : undefined}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PeriodSelector value={period.slice(0, 7)} />
        <p className="text-muted-foreground text-sm">
          Gastos: <span className="text-foreground font-medium">{formatMXN(exp.total)}</span>
          {gastosPct != null && (
            <span className={gastosDelta > 0 ? "text-destructive" : "text-emerald-600"}>
              {" "}
              {gastosDelta > 0 ? "▲" : "▼"} {Math.abs(Math.round(gastosPct * 100))}% vs mes anterior
            </span>
          )}
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isOwner && (
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">NOI del mes</p>
            <p className={`text-lg font-bold ${totals.noi < 0 ? "text-destructive" : ""}`}>{formatMXN(totals.noi)}</p>
          </CardContent></Card>
        )}
        <Card><CardContent className="py-4">
          <p className="text-muted-foreground text-xs">Cartera vencida</p>
          <p className={`text-lg font-bold ${carteraTotal > 0 ? "text-destructive" : ""}`}>{formatMXN(carteraTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-muted-foreground text-xs">Pagos a tiempo</p>
          <p className="text-lg font-bold">{pct(pay.puntualidad.pct)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-muted-foreground text-xs">Sin captar / mes</p>
          <p className={`text-lg font-bold ${totals.rentaPotencial - totals.ingresoEsperado > 0 ? "text-destructive" : ""}`}>
            {formatMXN(totals.rentaPotencial - totals.ingresoEsperado)}
          </p>
        </CardContent></Card>
      </div>

      {/* Tendencia */}
      <Section title="Tendencia (últimos 6 meses)" subtitle="Cobrado vs facturado cada mes — la dirección del negocio.">
        <Card><CardContent className="px-0 py-2">
          <div className="divide-y text-sm">
            {trend.map((m) => {
              const pctCob = m.facturado > 0 ? m.cobrado / m.facturado : 0;
              return (
                <div key={m.period} className="flex items-center gap-3 px-4 py-2">
                  <span className="text-muted-foreground w-20 shrink-0">{formatMonth(m.period)}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${Math.round((m.cobrado / trendMax) * 100)}%` }} />
                  </div>
                  <span className="w-44 shrink-0 text-right">
                    {formatMXN(m.cobrado)}{" "}
                    <span className="text-muted-foreground">/ {formatMXN(m.facturado)} ({pct(pctCob)})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      </Section>

      {/* Cobranza + antigüedad */}
      <Section title="Cobranza y antigüedad de cartera" subtitle={`Cobras el ${pct(aging.rate)} de lo facturado. Lo pendiente, por antigüedad:`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {aging.buckets.map((b) => (
            <Card key={b.label}><CardContent className="py-3">
              <p className="text-muted-foreground text-xs">{b.label}</p>
              <p className={`font-bold ${b.label === "+90 días" && b.monto > 0 ? "text-destructive" : ""}`}>{formatMXN(b.monto)}</p>
            </CardContent></Card>
          ))}
        </div>
      </Section>

      {/* Cobrado por forma de pago */}
      <Section
        title="Cobrado por forma de pago"
        subtitle="Lo que entró este mes (renta + cuotas), separado por efectivo y transferencia — para tu corte de caja."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Efectivo (caja)</p>
            <p className="text-lg font-bold">{formatMXN(cash.efectivo)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Transferencia</p>
            <p className="text-lg font-bold">{formatMXN(cash.transferencia)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Total cobrado</p>
            <p className="text-lg font-bold">{formatMXN(cash.total)}</p>
            {cash.otro > 0 && (
              <p className="text-muted-foreground text-xs">incluye {formatMXN(cash.otro)} en otros métodos</p>
            )}
          </CardContent></Card>
        </div>
      </Section>

      {/* Fondo de operación */}
      {opFund.rows.length > 0 && (
        <Section
          title="Fondo de operación"
          subtitle="Rentas cobradas menos gastos de operación, por edificio."
        >
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card><CardContent className="py-4">
              <p className="text-muted-foreground text-xs">Fondo actual (total)</p>
              <p className={`text-lg font-bold ${opFund.totals.fondoAcum < 0 ? "text-destructive" : ""}`}>{formatMXN(opFund.totals.fondoAcum)}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-muted-foreground text-xs">Saldo base (provisional)</p>
              <p className="text-lg font-bold">{formatMXN(opFund.totals.base)}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-muted-foreground text-xs">Movimiento del mes</p>
              <p className={`text-lg font-bold ${opFund.totals.fondoMes < 0 ? "text-destructive" : ""}`}>{formatMXN(opFund.totals.fondoMes)}</p>
            </CardContent></Card>
          </div>
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              <div className="text-muted-foreground grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium">
                <span className="col-span-4">Edificio</span>
                <span className="col-span-2 text-right">Saldo base</span>
                <span className="col-span-2 text-right">Cobrado mes</span>
                <span className="col-span-2 text-right">Gasto mes</span>
                <span className="col-span-2 text-right">Fondo actual</span>
              </div>
              {opFund.rows.map((r) => (
                <div key={r.property_id} className="grid grid-cols-12 items-center gap-2 px-4 py-2.5">
                  <span className="col-span-4 truncate font-medium">{r.name}</span>
                  <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.base)}</span>
                  <span className="col-span-2 text-right">{formatMXN(r.ingresoMes)}</span>
                  <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.egresoMes)}</span>
                  <span className={`col-span-2 text-right font-medium ${r.fondoAcum < 0 ? "text-destructive" : ""}`}>{formatMXN(r.fondoAcum)}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
          {opFund.hasProvisional && (
            <p className="text-muted-foreground mt-2 text-xs">Saldo base provisional, por ajustar con la asistente.</p>
          )}
        </Section>
      )}

      {/* Vencimientos próximos */}
      <Section title="Vencimientos próximos (90 días)" subtitle="Contratos por renovar — anticípate y evita huecos.">
        {expirations.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ningún contrato vence en los próximos 90 días (o falta capturar fechas).</p>
        ) : (
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              {expirations.map((e) => (
                <div key={e.lease_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.tenant}</p>
                    <p className="text-muted-foreground text-xs">{e.unit} · {formatMXN(e.rent)}/mes</p>
                  </div>
                  <span className="shrink-0 text-right">
                    {formatDate(e.end_date)}
                    <span className={`block text-xs ${e.dias <= 30 ? "text-destructive" : "text-muted-foreground"}`}>en {e.dias} días</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </Section>

      {/* Pronóstico de flujo (owner) */}
      {isOwner && forecast.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Pronóstico de flujo (6 meses)</h2>
          <Card>
            <CardContent className="space-y-2 py-4">
              {forecast.map((m) => {
                const pct = Math.round((m.esperado / forecastMax) * 100);
                const pctRiesgo = Math.round((m.enRiesgo / forecastMax) * 100);
                return (
                  <div key={m.period} className="text-sm">
                    <div className="mb-0.5 flex justify-between">
                      <span className="text-muted-foreground">{formatMonth(m.period)}</span>
                      <span className="font-medium">
                        {formatMXN(m.esperado)}
                        {m.enRiesgo > 0 && (
                          <span className="text-destructive"> · en riesgo {formatMXN(m.enRiesgo)}</span>
                        )}
                      </span>
                    </div>
                    <div className="bg-muted flex h-2 overflow-hidden rounded-full">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                      <div className="bg-destructive/60 h-full" style={{ width: `${pctRiesgo}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-muted-foreground pt-1 text-xs">
                Renta + cuota de contratos activos. “En riesgo” = contratos que vencen antes de
                ese mes y aún no se renuevan.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Concentración por arrendatario (owner) */}
      {isOwner && topTenants.tenants.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Concentración por arrendatario</h2>
          <Card>
            <CardContent className="space-y-2 py-4">
              {topTenants.tenants.map((t) => (
                <div key={t.name} className="text-sm">
                  <div className="mb-0.5 flex justify-between gap-3">
                    <span className="truncate">{t.name}</span>
                    <span className="shrink-0 font-medium">
                      {formatMXN(t.monto)} · {Math.round(t.pct * 100)}%
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full ${t.pct > 0.25 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.round(t.pct * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-muted-foreground pt-1 text-xs">
                Si un arrendatario pasa del 25% de tu ingreso, su salida pega fuerte. Es tu riesgo de
                concentración (Brive).
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Satisfacción del arrendatario (owner) */}
      {isOwner && satis.count > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Satisfacción del arrendatario</h2>
          <Card>
            <CardContent className="py-4">
              <p className="text-2xl font-bold">{satis.avg.toFixed(1)} / 5 ⭐</p>
              <p className="text-muted-foreground text-xs">
                {satis.count} calificación{satis.count === 1 ? "" : "es"} tras resolver reportes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking de rentabilidad (owner) */}
      {isOwner && (
        <Section title="Ranking de rentabilidad" subtitle="Edificios ordenados por cap rate (y NOI).">
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              <div className="text-muted-foreground grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium">
                <span className="col-span-4">Edificio</span>
                <span className="col-span-3 text-right">NOI / mes</span>
                <span className="col-span-2 text-right">$/m²</span>
                <span className="col-span-2 text-right">Cap rate</span>
                <span className="col-span-1 text-right">Ocup.</span>
              </div>
              {ranking.map((b, i) => (
                <div key={b.property_id} className="grid grid-cols-12 items-center gap-2 px-4 py-2.5">
                  <span className="col-span-4 truncate font-medium">{i + 1}. {b.name}</span>
                  <span className={`col-span-3 text-right ${b.noi < 0 ? "text-destructive" : ""}`}>{formatMXN(b.noi)}</span>
                  <span className="col-span-2 text-right">{b.rentPerM2 != null ? formatMXN(Math.round(b.rentPerM2)) : "—"}</span>
                  <span className="col-span-2 text-right">{b.capRate != null ? pct(b.capRate) : "—"}</span>
                  <span className="col-span-1 text-right">{pct(b.ocupacionIngresos)}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </Section>
      )}

      {/* Precio de mercado */}
      <Section
        title="Precio de mercado"
        subtitle={`Renta actual vs el estudio de mercado (mín/prom/máx), en ${market.comparables} unidades ocupadas con renta capturada.`}
      >
        {market.withData === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay precios de mercado cargados.
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card><CardContent className="py-4">
                <p className="text-muted-foreground text-xs">Potencial sin captar / mes</p>
                <p className={`text-lg font-bold ${market.upliftPotential > 0 ? "text-primary" : ""}`}>{formatMXN(market.upliftPotential)}</p>
                <p className="text-muted-foreground text-xs">si cada renta llegara al promedio de mercado</p>
              </CardContent></Card>
              <Card><CardContent className="py-4">
                <p className="text-muted-foreground text-xs">Por debajo del mínimo de mercado</p>
                <p className={`text-lg font-bold ${market.belowCount > 0 ? "text-primary" : ""}`}>{market.belowCount} unidades</p>
                <p className="text-muted-foreground text-xs">candidatas a subir en la próxima renovación</p>
              </CardContent></Card>
            </div>
            <Card><CardContent className="px-0 py-0">
              <div className="divide-y text-sm">
                <div className="text-muted-foreground grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium">
                  <span className="col-span-4">Unidad</span>
                  <span className="col-span-2 text-right">Actual</span>
                  <span className="col-span-2 text-right">Mín</span>
                  <span className="col-span-2 text-right">Prom</span>
                  <span className="col-span-2 text-right">vs prom</span>
                </div>
                {market.rows.map((r) => (
                  <div key={r.unitId} className="grid grid-cols-12 items-center gap-2 px-4 py-2.5">
                    <span className="col-span-4 truncate font-medium">{r.unit}</span>
                    <span className="col-span-2 text-right">{formatMXN(r.current)}</span>
                    <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.min)}</span>
                    <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.avg)}</span>
                    <span className={`col-span-2 text-right ${r.status === "abajo" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {r.gap >= 0 ? "+" : ""}{formatMXN(r.gap)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
            {(market.vacantes > 0 || market.sinRenta > 0) && (
              <p className="text-muted-foreground mt-2 text-xs">
                No se comparan: {market.vacantes} vacante{market.vacantes === 1 ? "" : "s"}
                {market.sinRenta > 0 && ` y ${market.sinRenta} con renta por capturar`} (revisar con la asistente).
              </p>
            )}
          </>
        )}
      </Section>

      {/* Cartera / quién debe */}
      <Section title="Quién debe (cartera vencida)" subtitle={`${debtors.length} con adeudo · ${formatMXN(carteraTotal)} en total.`}>
        {debtors.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nadie debe. 🎉</p>
        ) : (
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              {debtors.map((d) => (
                <div key={d.lease_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.tenant}</p>
                    <p className="text-muted-foreground text-xs">{d.unit} · {d.diasAtraso} días</p>
                  </div>
                  <span className="text-destructive shrink-0 font-semibold">{formatMXN(d.saldoVencido)}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </Section>

      {/* Puntualidad */}
      <Section title="Puntualidad de pago" subtitle={`${pay.puntualidad.aTiempo} de ${pay.puntualidad.total} pagos se hicieron a tiempo (${pct(pay.puntualidad.pct)}).`}>
        {pay.puntualidad.morosos.length > 0 ? (
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              <div className="text-muted-foreground px-4 py-2 text-xs font-medium">Quién paga tarde más seguido</div>
              {pay.puntualidad.morosos.map((m) => (
                <div key={m.tenant} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate font-medium">{m.tenant}</span>
                  <span className="text-muted-foreground shrink-0">{m.tarde} de {m.total} tarde</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        ) : (
          <p className="text-muted-foreground text-sm">Todos pagan a tiempo. 🎉</p>
        )}
      </Section>

      {/* Facturación con/sin */}
      <Section title="Pagos con o sin factura" subtitle="De todo lo cobrado, cuánto se facturó.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Con factura</p>
            <p className="text-lg font-bold">{formatMXN(pay.facturacion.con.monto)}</p>
            <p className="text-muted-foreground text-xs">{pay.facturacion.con.n} pagos</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Sin factura</p>
            <p className="text-lg font-bold">{formatMXN(pay.facturacion.sin.monto)}</p>
            <p className="text-muted-foreground text-xs">{pay.facturacion.sin.n} pagos</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Factura pendiente</p>
            <p className="text-destructive text-lg font-bold">{formatMXN(pay.facturacion.pendiente.monto)}</p>
            <p className="text-muted-foreground text-xs">{pay.facturacion.pendiente.n} pagos</p>
          </CardContent></Card>
        </div>
      </Section>

      {/* Gastos por categoría */}
      <Section title="Gastos por categoría" subtitle={`${formatMonth(period)} · ${formatMXN(exp.total)} en total · ${formatMXN(exp.totalConFactura)} con factura.`}>
        {exp.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin gastos registrados este mes.</p>
        ) : (
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              {exp.rows.map((r) => (
                <div key={r.category} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="font-medium">{EXPENSE_CATEGORY_LABELS[r.category]}</span>
                  <span className="text-right">
                    {formatMXN(r.total)}
                    <span className="text-muted-foreground text-xs"> · {formatMXN(r.conFactura)} c/factura</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </Section>

      {/* Riesgo y eficiencia */}
      <Section title="Riesgo y eficiencia" subtitle="Qué tan eficiente es la operación y qué tan concentrado está el ingreso.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Razón de gastos</p>
            <p className={`text-lg font-bold ${expenseRatio > 0.5 ? "text-destructive" : ""}`}>{pct(expenseRatio)}</p>
            <p className="text-muted-foreground text-xs">de cada peso de renta se va en gastos</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Edificio que más pesa</p>
            <p className="text-lg font-bold">{topBuilding ? pct(topBuildingPct) : "—"}</p>
            <p className="text-muted-foreground truncate text-xs">{topBuilding?.name ?? "—"}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Arrendatario que más pesa</p>
            <p className={`text-lg font-bold ${conc.topTenant && conc.topTenant.pct > 0.25 ? "text-destructive" : ""}`}>
              {conc.topTenant ? pct(conc.topTenant.pct) : "—"}
            </p>
            <p className="text-muted-foreground truncate text-xs">{conc.topTenant?.name ?? "—"}</p>
          </CardContent></Card>
        </div>
      </Section>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <AlertTriangle className="size-3.5" />
        Precios de mercado del estudio MPM; plusvalía con valor de compra vs precio sugerido. Confirma con la asistente.
      </p>
    </>
  );
}
