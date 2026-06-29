import "server-only";
import type { createAdminClient } from "@/app/_lib/supabase/admin";

/**
 * Genera un enlace mágico de un solo uso para que el arrendatario entre sin
 * contraseña. No envía correo (Resend aún sin dominio); el staff lo copia y se
 * lo comparte por WhatsApp. Devuelve null si algo falla (best-effort).
 */
export async function generateInviteLink(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: process.env.NEXT_PUBLIC_SITE_URL },
    });
    return data?.properties?.action_link ?? null;
  } catch {
    return null;
  }
}
