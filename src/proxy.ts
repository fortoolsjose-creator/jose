import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/app/_lib/supabase/proxy-session";

/**
 * proxy.ts is the Next 16 replacement for middleware.ts (Node runtime only).
 * It is OPTIMISTIC: it refreshes the session and bounces obviously-unauthenticated
 * users away from protected pages for a snappy UX. The real authorization boundary
 * is Supabase RLS (enforced in the database) plus per-page checks in the DAL — never
 * trust this file alone.
 */

// Routes that require an authenticated session (admin + tenant areas).
const PROTECTED_PREFIXES = [
  // admin (owner / staff)
  "/panel",
  "/propiedades",
  "/inquilinos",
  "/cobros",
  "/mantenimiento",
  "/vacantes",
  "/ajustes",
  // tenant (arrendatario)
  "/inicio",
  "/mi-renta",
  "/mis-reportes",
  "/mi-contrato",
];

// Auth pages a signed-in user should not sit on.
const AUTH_PAGES = ["/login", "/recuperar"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in but on an auth page → send home; "/" picks the role-correct home.
  if (user && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals, the manifest, and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
