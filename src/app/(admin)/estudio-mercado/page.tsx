import type { Metadata } from "next";
import { listMarketStudy } from "@/app/_lib/data/market-study";
import { PageHeader } from "@/app/_components/page-header";
import { MarketStudyTable } from "./_components/market-study-table";

export const metadata: Metadata = { title: "Estudio de mercado" };

export default async function EstudioMercadoPage() {
  const rows = await listMarketStudy();
  const withData = rows.filter((r) => r.avg != null).length;

  return (
    <>
      <PageHeader
        title="Estudio de mercado"
        subtitle={`Renta de mercado (mín/prom/máx) por unidad · ${withData} de ${rows.length} con dato. Actualízalos aquí cuando hagas tu investigación.`}
      />
      <MarketStudyTable rows={rows} />
    </>
  );
}
