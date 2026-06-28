import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type-check <Link href> against real routes (stable in Next 16).
  typedRoutes: true,
  // Allow next/image to load from Supabase Storage.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
  },
  // Note: Cache Components (`cacheComponents: true`) is intentionally NOT enabled for
  // Phase 0. Pages read the auth session (cookies), which makes them dynamic and fresh
  // by default — exactly what money screens need. We can opt into granular caching with
  // the `'use cache'` directive later if read-heavy views need it.
  experimental: {
    // File uploads (INE, comprobantes, fotos) go through Server Actions, which Next
    // caps at 1MB by default — a normal phone photo (2-5MB) would be rejected before
    // our code runs. Match the 30MB the application action already validates.
    serverActions: { bodySizeLimit: "30mb" },
  },
  // Security headers. CSP is intentionally limited to `frame-ancestors 'none'`
  // (anti-clickjacking) to avoid breaking Next's inline styles/scripts; the rest
  // close common attack classes at zero risk.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
