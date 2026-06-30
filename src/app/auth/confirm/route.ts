import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/app/_lib/supabase/server";

/**
 * Confirma OTP por token_hash (recovery / magic link / invite) SIN PKCE.
 * Sirve para enlaces generados por el admin (generateLink), que no traen el
 * `code` de PKCE que espera /auth/callback. Verifica y deja la sesión en
 * cookies, luego redirige a `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
