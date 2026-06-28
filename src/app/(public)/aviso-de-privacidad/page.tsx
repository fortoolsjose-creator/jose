import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Aviso de privacidad · Metros Redondos" };

export default function AvisoDePrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Inicio
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Aviso de privacidad</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Última actualización: junio de 2026
      </p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <section className="space-y-1.5">
          <h2 className="font-semibold">1. Responsable</h2>
          <p>
            <strong>Metros Redondos</strong>, con domicilio en la Ciudad de México,
            es responsable del tratamiento de tus datos personales, conforme a la Ley
            Federal de Protección de Datos Personales en Posesión de los Particulares
            (LFPDPPP). Contacto: WhatsApp 55 2086 4155.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">2. Datos que recabamos</h2>
          <p>
            Para evaluar una solicitud de arrendamiento podemos recabar: nombre,
            correo electrónico, teléfono, ingreso mensual, identificación oficial
            (INE), comprobante de ingresos y documentos de garantía (aval o póliza).
            No recabamos datos personales sensibles.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">3. Finalidades</h2>
          <p>
            Usamos tus datos para: (a) evaluar tu solicitud y tu capacidad de pago;
            (b) elaborar y dar seguimiento al contrato de arrendamiento si eres
            aceptado; (c) contactarte sobre tu solicitud. No usamos tus datos para
            fines distintos sin tu consentimiento.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">4. Conservación</h2>
          <p>
            Si tu solicitud no es aceptada, conservamos tus documentos solo el tiempo
            necesario para la evaluación y luego los suprimimos. Si firmas contrato,
            tus datos se conservan mientras dure la relación de arrendamiento y los
            plazos legales aplicables.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">5. Transferencias</h2>
          <p>
            No transferimos tus datos a terceros sin tu consentimiento, salvo cuando
            la ley lo exija (por ejemplo, requerimientos de autoridad).
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">6. Tus derechos (ARCO)</h2>
          <p>
            Puedes Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus
            datos, así como revocar tu consentimiento, escribiéndonos al contacto del
            punto 1. Te responderemos en los plazos que marca la ley.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold">7. Cambios</h2>
          <p>
            Podemos actualizar este aviso. La versión vigente estará siempre
            disponible en esta página.
          </p>
        </section>
      </div>
    </main>
  );
}
