import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { createClient } from "@/app/_lib/supabase/server";
import { listAnnouncements } from "@/app/_lib/data/announcements";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/app/_lib/format";
import { ConfirmDeleteButton } from "../propiedades/_components/confirm-delete-button";
import { AnnouncementDialog } from "./_components/announcement-dialog";
import { deleteAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Avisos" };

export default async function AnunciosPage() {
  const supabase = await createClient();
  const [{ data: props }, anuncios] = await Promise.all([
    supabase.from("properties").select("id, name").is("deleted_at", null).order("name"),
    listAnnouncements(),
  ]);

  return (
    <>
      <PageHeader
        title="Avisos"
        subtitle="Comunica a tus arrendatarios cortes de agua, mantenimientos, cambios de cuenta… Lo ven en su portal."
        action={<AnnouncementDialog properties={props ?? []} />}
      />

      {anuncios.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin avisos"
          description="Publica un aviso y aparecerá en el inicio de tus arrendatarios."
        />
      ) : (
        <div className="space-y-3">
          {anuncios.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  {a.body && <p className="text-muted-foreground mt-0.5 text-sm">{a.body}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {[
                      a.propertyName ?? "Todos los edificios",
                      a.until ? `vigente hasta ${formatDate(a.until)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ConfirmDeleteButton
                  onConfirm={deleteAnnouncement.bind(null, a.id)}
                  title="¿Eliminar aviso?"
                  description={`Se quitará "${a.title}".`}
                  triggerLabel=""
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
