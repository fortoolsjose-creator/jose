import { NextResponse } from "next/server";
import { createClient } from "@/app/_lib/supabase/server";

/**
 * OAuth / magic-link / password-recovery callback. Exchanges the `code` for a
 * session (PKCE flow used by @supabase/ssr), then redirects to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
