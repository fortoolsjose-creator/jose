# Llave

A mobile-first, multi-tenant rental-management web app for small residential
landlords in Mexico City (CDMX). One system, two doors:

1. **Service** — keep current tenants (_inquilinos_) happy and rent/receipts
   organized. _(Priority.)_
2. **Acquisition** — fill vacant units with new renters and convert an approved
   applicant into a tenant. _(Phase 2.)_

All UI is in Spanish (es-MX); currency is MXN. The app is installable as a PWA.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **Supabase** — Postgres, Auth, Storage, Row-Level Security
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives) + lucide icons
- **react-hook-form** + **zod**
- Hosting target: **Vercel**

> This project targets **Next.js 16**, which differs from older versions
> (`middleware.ts` → `proxy.ts`, async `cookies()`/`params`, fetch uncached by
> default). See `docs/next16-phase0-notes.md` for the conventions this codebase
> follows.

## Prerequisites

- **Node.js ≥ 20.9** (built and tested on Node 24 LTS)
- A **Supabase** project (free tier is fine)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then fill in your Supabase Project URL + anon key + service-role key
#   (Supabase dashboard -> Project Settings -> API)

# 3. Apply the database schema
#   Option A (no tooling): open the Supabase SQL Editor, paste the contents of
#   supabase/schema.sql, and Run.
#   Option B (CLI): supabase link --project-ref <ref> && supabase db push

# 4. Seed realistic CDMX demo data (uses the service-role key over the API)
npm run seed

# 5. Run the dev server
npm run dev   # http://localhost:3000
```

### Demo accounts (after seeding)

Password: set locally after seeding (never committed).

| Role          | Email                      | State                 |
| ------------- | -------------------------- | --------------------- |
| Owner (admin) | `ana@propiedadesgarcia.mx` | —                     |
| Tenant        | `luis@example.com`         | June rent **overdue** |
| Tenant        | `maria@example.com`        | Up to date            |
| Tenant        | `jorge@example.com`        | June **pending**      |

## Scripts

| Command         | What it does                                         |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | Start the dev server                                 |
| `npm run build` | Production build (also type-checks)                  |
| `npm run start` | Serve the production build                           |
| `npm run seed`  | Seed demo data (needs schema applied + `.env.local`) |

## Project structure

```
src/
  proxy.ts                     # auth/role redirects + Supabase session refresh (Next 16 "middleware")
  app/
    layout.tsx                 # root <html>, es-MX, viewport, PWA manifest
    manifest.ts                # PWA manifest
    (public)/                  # landing, login, password recovery
    (admin)/                   # owner/staff back office (panel, cobros, ...)
    (tenant)/                  # tenant portal (inicio, mi-renta, ...)
    auth/callback/route.ts     # OAuth / recovery code exchange
    _components/               # shared UI (app shell, nav, empty states)
    _lib/                      # supabase clients, DAL, formatting, schemas
  components/ui/               # shadcn/ui components
supabase/
  migrations/                  # source-of-truth SQL migrations
  schema.sql                   # all migrations concatenated (paste-and-run)
  seed.mjs                     # demo data
scripts/generate-icons.mjs     # regenerate PWA icons
docs/next16-phase0-notes.md    # Next 16 conventions for this codebase
```

## Roles & security

- **owner / staff** — full CRUD over their organization's data.
- **tenant** — read-only on their own lease/unit/payments; can file maintenance
  requests and submit a SPEI reference for a payment.
- **public** — can view a published listing and submit an application.

Tenant isolation is enforced by **Postgres Row-Level Security** (the real
boundary), not by app code. The `proxy.ts` redirects and DAL checks are UX /
defense-in-depth. The service-role key is used only by trusted server jobs
(seeding) and never for tenant-facing queries.

## Notes & known limits (Phase 0)

- **Phone OTP login** requires an SMS provider configured in Supabase
  (Authentication -> Providers -> Phone). Email/password works out of the box.
- The `service_role` key was shared during setup — **rotate it before
  production** (Supabase -> Project Settings -> API -> roll keys).
- PWA install requires HTTPS in production; locally test with
  `next dev --experimental-https`.

## Status

- **Phase 0 (foundation)** — complete: schema + RLS + storage, auth
  (email/password + phone OTP), responsive Spanish app shell, seed, PWA.
- **Phase 1 (service door)** — next: properties/units/leases, payments &
  receipts, maintenance tickets, tenant portal, notifications.
