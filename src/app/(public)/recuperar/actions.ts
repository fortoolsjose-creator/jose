"use server";

import { createClient } from "@/app/_lib/supabase/server";
import { emailOnlySchema } from "@/app/_lib/auth-schemas";

export type RecoverState = { error?: string; sent?: boolean };

export async function requestReset(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Correo no válido." };

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}/auth/callback?next=/actualizar-clave`,
  });
  if (error) return { error: "No pudimos enviar el correo. Intenta de nuevo." };

  return { sent: true };
}
