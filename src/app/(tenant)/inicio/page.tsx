import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, BellRing, Wrench } from "lucide-react";
import { getProfile } from "@/app/_lib/dal";
import { listActiveAnnouncements } from "@/app/_lib/data/announcements";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const [profile, anuncios] = await Promise.all([
    getProfile(),
    listActiveAnnouncements(),
  ]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Hola{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-muted-foreground text-sm">¿Qué necesitas hoy?</p>
      </div>

      {anuncios.length > 0 && (
        <div className="space-y-2">
          {anuncios.slice(0, 3).map((a) => (
            <div key={a.id} className="bg-primary/5 border-primary/20 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <BellRing className="text-primary size-4 shrink-0" />
                <p className="font-medium">{a.title}</p>
              </div>
              {a.body && <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4">
        <Link
          href="/mis-reportes"
          className="bg-card hover:bg-muted flex items-center gap-4 rounded-xl border p-6 shadow-sm transition"
        >
          <div className="bg-primary/10 rounded-full p-3">
            <Wrench className="text-primary size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Reportar un problema</p>
            <p className="text-muted-foreground text-sm">
              Plomería, luz, cerradura, lo que sea
            </p>
          </div>
        </Link>

        <Link
          href="/mi-renta"
          className="bg-card hover:bg-muted flex items-center gap-4 rounded-xl border p-6 shadow-sm transition"
        >
          <div className="bg-primary/10 rounded-full p-3">
            <Banknote className="text-primary size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Mi renta</p>
            <p className="text-muted-foreground text-sm">
              Tu próximo pago y tus recibos
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
