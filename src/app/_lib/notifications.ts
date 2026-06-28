import "server-only";

/**
 * Centralized notification service. Phase 1 sends email; WhatsApp slots in here
 * in Phase 3. By default it MOCKS (logs to the server console) so the app runs
 * with zero paid services. If RESEND_API_KEY is set, it sends real email.
 */

export type NotificationTemplate =
  | "request_received"
  | "request_status_changed"
  | "request_replied"
  | "payment_confirmed"
  | "payment_reminder"
  | "renewal_reminder"
  | "poliza_reminder";

export type NotificationInput = {
  to: string;
  template: NotificationTemplate;
  data?: Record<string, unknown>;
};

const mxn = (n: unknown) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(n ?? 0),
  );

function render(n: NotificationInput): { subject: string; body: string } {
  const d = n.data ?? {};
  switch (n.template) {
    case "request_received":
      return {
        subject: "Recibimos tu reporte",
        body: `Hola, recibimos tu reporte "${d.title}". Te atendemos pronto.`,
      };
    case "request_status_changed":
      return {
        subject: "Actualización de tu reporte",
        body: `Tu reporte "${d.title}" cambió a: ${d.status}.`,
      };
    case "request_replied":
      return {
        subject: "Respuesta a tu reporte",
        body: `Tu arrendador respondió en tu reporte "${d.title}". Entra a la plataforma para verlo.`,
      };
    case "payment_confirmed":
      return {
        subject: "Pago confirmado",
        body: `Confirmamos tu pago de la renta de ${d.period} por ${mxn(d.amount)}. ¡Gracias!`,
      };
    case "payment_reminder": {
      const link =
        (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrosredondos.vercel.app") +
        "/mi-renta";
      const amount = mxn(d.amount);
      switch (d.cadence) {
        case "due":
          return {
            subject: `Hoy vence tu renta de ${d.period}`,
            body: `Hola, hoy vence tu renta de ${d.period} (${amount}). Págala o avísanos que ya pagaste aquí: ${link}`,
          };
        case "overdue":
          return {
            subject: `Tu renta de ${d.period} venció`,
            body: `Hola, tu renta de ${d.period} (${amount}) venció el ${d.dueDate}. Si ya pagaste, ignora este mensaje. Si no, ponte al corriente aquí: ${link}`,
          };
        case "overdue7":
          return {
            subject: `Tu renta de ${d.period} sigue pendiente`,
            body: `Tu renta de ${d.period} (${amount}) sigue pendiente desde el ${d.dueDate}. Si tienes algún problema para pagar, escríbenos. Paga o avísanos aquí: ${link}`,
          };
        default:
          return {
            subject: `Tu renta de ${d.period} vence pronto`,
            body: `Hola, te recordamos que tu renta de ${d.period} (${amount}) vence el ${d.dueDate}. Puedes pagarla aquí: ${link}`,
          };
      }
    }
    case "renewal_reminder": {
      const when =
        d.cadence === "90d"
          ? "en 3 meses"
          : d.cadence === "30d"
            ? "en 1 mes"
            : "en 15 días";
      if (d.audience === "staff") {
        return {
          subject: `Renovación próxima: ${d.unit}`,
          body: `El contrato de ${d.tenant} (${d.unit}) vence ${when}, el ${d.endDate}. Conviene preparar la renovación y el ajuste de renta.`,
        };
      }
      return {
        subject: `Tu contrato vence ${when}`,
        body: `Hola, te recordamos que tu contrato (${d.unit}) vence ${when}, el ${d.endDate}. Si quieres renovar, contáctanos.`,
      };
    }
    case "poliza_reminder":
      return {
        subject: `Vence garantía/póliza: ${d.unit}`,
        body: `La garantía/póliza de ${d.tenant} (${d.unit}) vence el ${d.fecha}. Conviene renovarla o solicitar su actualización para no quedar sin respaldo.`,
      };
  }
}

export async function notify(n: NotificationInput): Promise<void> {
  const { subject, body } = render(n);
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.NOTIFICATIONS_FROM ?? "Metros Redondos <onboarding@resend.dev>",
          to: n.to,
          subject,
          text: body,
        }),
      });
      return;
    } catch (e) {
      console.error("[notify] Resend failed, falling back to mock:", e);
    }
  }

  // Mock transport — visible in the dev server console.
  console.log(`[notify:mock] to=${n.to} | ${subject} | ${body}`);
}
