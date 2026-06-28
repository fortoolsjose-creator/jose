import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/app/_lib/dal";
import { getProfitability } from "@/app/_lib/data/profitability";
import { PageHeader } from "@/app/_components/page-header";
import { RegionTable } from "./_components/region-table";

export const metadata: Metadata = { title: "Rentabilidad por región" };

export default async function RentabilidadRegionPage() {
  const profile = await getProfile();
  if (profile?.role !== "owner") redirect("/panel");

  const { buildings } = await getProfitability();

  return (
    <>
      <PageHeader
        title="Rentabilidad por región"
        subtitle="Agrupa tus propiedades por zona para ver dónde se concentra el ingreso y el NOI."
      />

      <p className="text-muted-foreground mb-4 text-sm">
        Cambia el corte con el botón. Ingreso = renta esperada de contratos activos
        (este mes); NOI = ingreso − gastos del mes. Las propiedades sin zona capturada
        salen en <span className="font-medium">“Sin región”</span> — complétalas en
        Propiedades → Editar (colonia, alcaldía, ciudad).
      </p>

      <RegionTable buildings={buildings} />
    </>
  );
}
