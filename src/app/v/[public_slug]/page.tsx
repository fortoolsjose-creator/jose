import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/app/_lib/data/applications";
import { formatMXN, formatDate } from "@/app/_lib/format";
import { ApplicationForm } from "./application-form";

export async function generateMetadata(props: {
  params: Promise<{ public_slug: string }>;
}): Promise<Metadata> {
  const { public_slug } = await props.params;
  const listing = await getListingBySlug(public_slug);
  return { title: listing ? `${listing.title} · Llave` : "Vacante" };
}

export default async function PublicListingPage(props: {
  params: Promise<{ public_slug: string }>;
}) {
  const { public_slug } = await props.params;
  const listing = await getListingBySlug(public_slug);
  if (!listing) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
      <p className="mt-2 text-2xl font-semibold">
        {formatMXN(listing.rent_amount)}{" "}
        <span className="text-muted-foreground text-base font-normal">/ mes</span>
      </p>
      {listing.available_from && (
        <p className="text-muted-foreground text-sm">
          Disponible desde {formatDate(listing.available_from)}
        </p>
      )}

      {listing.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {listing.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Foto ${i + 1}`}
              className="aspect-video w-full rounded-lg border object-cover"
            />
          ))}
        </div>
      )}

      {listing.description && (
        <p className="mt-4 whitespace-pre-line">{listing.description}</p>
      )}

      {listing.requirements && (
        <div className="bg-muted/40 mt-4 rounded-lg border p-3 text-sm">
          <p className="mb-1 font-medium">Requisitos</p>
          <p className="text-muted-foreground whitespace-pre-line">
            {listing.requirements}
          </p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Solicitar esta vivienda</h2>
        <ApplicationForm listingId={listing.id} />
      </div>

      <p className="text-muted-foreground mt-10 text-center text-xs">
        Metros Redondos
      </p>
    </main>
  );
}
