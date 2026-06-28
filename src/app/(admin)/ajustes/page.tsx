import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { getProfile } from "@/app/_lib/dal";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const profile = await getProfile();
  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Datos de tu organización y tu cuenta."
      />
      <div className="text-muted-foreground mb-6 text-sm">
        Sesión iniciada como{" "}
        <span className="text-foreground font-medium">
          {profile?.full_name ?? profile?.email}
        </span>{" "}
        ({profile?.role}).
      </div>
      <EmptyState
        icon={Settings}
        title="Configuración en camino"
        description="Logo, CLABE para depósitos, RFC y datos de la organización se editarán aquí. (Llega en la Fase 1.)"
      />
    </>
  );
}
