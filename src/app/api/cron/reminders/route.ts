import { NextResponse } from "next/server";
import {
  runReminderSweep,
  runRenewalReminderSweep,
  runPolizaReminderSweep,
} from "@/app/_lib/reminders";

// Disparado por Vercel Cron (configurado en vercel.json). Vercel manda el header
// Authorization: Bearer ${CRON_SECRET} automáticamente cuando esa variable existe.
// Así nadie de fuera puede dispararlo. Corre en runtime Node (cliente admin).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Fail-closed: si no hay secreto configurado, NADIE puede dispararlo.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reminders] CRON_SECRET no configurado — solicitud rechazada.");
    return new NextResponse("Cron no configurado", { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const pagos = await runReminderSweep();
    const renovaciones = await runRenewalReminderSweep();
    const polizas = await runPolizaReminderSweep();
    return NextResponse.json({ ok: true, pagos, renovaciones, polizas });
  } catch (e) {
    console.error("[cron/reminders] failed:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
