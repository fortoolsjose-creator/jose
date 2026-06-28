# Next.js 16 — Phase 0 Build Notes (Llave)

Canonical reference for the **Llave** stack: mobile-first, multi-tenant rental-management SaaS.
Next.js 16 App Router · TypeScript (strict) · Tailwind v4 · shadcn/ui · Supabase (Auth + Postgres + RLS + Storage) · Spanish (es-MX) UI · installable PWA.

> **Read this before writing any code.** Most LLM-trained knowledge assumes Next 13/14/15. Next 16 changed defaults that break those assumptions silently. The rule of thumb: **everything is async, nothing is cached, middleware is gone.**

---

## 1. Breaking changes vs older Next (do-this-not-that)

| Topic | OLD (≤15) | NEW (16) — do this |
|---|---|---|
| `cookies()`, `headers()`, `draftMode()` | sync | **`await cookies()`** — sync access is removed, no `UnsafeUnwrappedCookies` escape hatch |
| `params`, `searchParams` | plain object | **`Promise<T>`** at the type level — `await props.params` |
| Image-gen `params`/`id` (opengraph-image, icon…) | sync | **`await params`**, **`await id`** |
| `sitemap()` `id` from `generateSitemaps` | sync | **`await id`** |
| `revalidateTag(tag)` | 1 arg | **`revalidateTag(tag, 'max')`** — 2nd `cacheLife` arg required |
| `middleware.ts` / `export function middleware()` | — | **`proxy.ts`** / **`export function proxy()`** — Node runtime only |
| Parallel route slots (`@modal`) | optional `default.js` | **`default.tsx` required** or build fails |
| fetch caching | cached by default (≤14) | **not cached** — pass `{ cache: 'force-cache' }` or use `'use cache'` |
| Route Handler `GET` caching | cached | not cached — `export const dynamic = 'force-static'` to opt in |
| `experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache` | — | **`cacheComponents: true`** (top-level) |
| `unstable_cacheLife` / `unstable_cacheTag` | prefixed | **`import { cacheLife, cacheTag } from 'next/cache'`** |
| `next/legacy/image` | ok | **`next/image`** |
| `images.domains` | ok | **`images.remotePatterns`** |
| `serverRuntimeConfig` / `publicRuntimeConfig` | ok | **removed** → `process.env` (server) / `NEXT_PUBLIC_*` (client) |
| `next lint` | ran on build | **removed** — run ESLint/Biome directly; `next build` no longer lints |
| ESLint config | `.eslintrc` | **Flat config** default |
| `experimental.turbopack` | nested | **top-level `turbopack`** in `next.config.ts` |
| `--turbopack` flag | needed | **default** — remove the flag; webpack config now needs `--webpack` |

**Hard floors:** Node **20.9.0 LTS**, TypeScript **5.1.0**. Browsers: Chrome/Edge/Firefox 111+, Safari 16.4+.

**Other removals to not trip on:** AMP, `next/amp`; `nextRequest.geo`/`.ip`; `@next/font` (use `next/font`); `runtime: 'experimental-edge'` → `'edge'`; `devIndicators.{appIsrStatus,buildActivity,buildActivityPosition}`; `unstable_rootParams`. Build output no longer prints `size`/`First Load JS`. `next dev` now writes to `.next/dev` and loads config once (so `process.argv.includes('dev')` is `false` — branch on `NODE_ENV === 'development'`).

```ts
// ❌ OLD
const cookieStore = cookies()
type Params = { slug: string }
revalidateTag('ledger')

// ✅ NEW (16)
const cookieStore = await cookies()
type Params = Promise<{ slug: string }>
revalidateTag('ledger', 'max')
```

**Image defaults got stricter** — override only if needed:
- `minimumCacheTTL`: 60s → **14400s (4h)**. Set back to `60` if you expect frequent image updates.
- `qualities`: any → **`[75]`** only (other values silently coerce to 75).
- `imageSizes`: `16` dropped from the default array.
- `dangerouslyAllowLocalIP`: now **blocked**; local images with query strings need `images.localPatterns[].search`.
- `maximumRedirects`: now **3**.

---

## 2. Project & route structure

File-system routing: folders = URL segments, `page.tsx` makes a route public, `layout.tsx` is shared UI. Server Components by default; `'use client'` opts into the client.

```
app/
  layout.tsx                  # root <html>/<body>, viewport, metadata (optional if every route is grouped)
  manifest.ts                 # PWA manifest (root app/ only)
  (public)/                   # marketing + auth — route group, invisible in URL
    layout.tsx
    page.tsx                  # → /
    login/page.tsx            # → /login
  (tenant)/                   # the rental app, per landlord/org
    layout.tsx
    dashboard/page.tsx        # → /dashboard
    propiedades/[id]/page.tsx # → /propiedades/:id
  (admin)/                    # platform-internal back office
    layout.tsx
    page.tsx                  # → /
  _components/                # private (leading _) — never routable
  _lib/
```

**Route groups `(admin)`/`(tenant)`/`(public)`**: parentheses organize without touching the URL. Each group **may** have its own root layout with its own `<html>`/`<body>` — but **navigating between two different root layouts triggers a full page reload, not a client transition.** Keep cross-group navigation rare (e.g. login → dashboard is a hard nav, which is fine).

**`params`/`searchParams` are async** (`Promise<T>`):

```tsx
// app/(tenant)/propiedades/[id]/page.tsx
export default async function Page(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await props.params
  const { tab } = await props.searchParams   // plain object — NOT URLSearchParams
  return <h1>{id}</h1>
}
```

- Client Components unwrap with React's `use()`: `const { id } = use(params)`.
- Catch-all `[...slug]` → `params.slug` is a **string array**.
- Layouts **cannot** read `searchParams` (use the page prop or a client `useSearchParams`) and **cannot** read `pathname` (use client `usePathname`). Layouts do **not** re-render on navigation.
- Use the auto-generated globals `PageProps<'/propiedades/[id]'>` / `LayoutProps<'/dashboard'>` for typed props (generated by `next dev`/`next build`/`next typegen` — no import).
- Add `loading.tsx` per dynamic segment; without it the client blocks on the server response.

---

## 3. Server vs Client Components & Server Actions

- **Server Components are the default** and may be `async`. Client Components (`'use client'`) cannot be async — they unwrap promises with `use()`.
- Props crossing server→client must be **serializable** (no functions/classes/raw Dates). To pass behavior, import a `'use server'` function.
- `React.cache()` memoizes **within a single request**, not across requests.

```tsx
// Streaming: don't await in the Server Component; pass the promise down
import { Suspense } from 'react'
export default function Page() {
  const properties = getProperties()                 // no await
  return <Suspense fallback={<Skeleton />}><List properties={properties} /></Suspense>
}
// list.tsx
'use client'
import { use } from 'react'
export function List({ properties }: { properties: Promise<Property[]> }) {
  const all = use(properties)
  return <ul>{all.map(p => <li key={p.id}>{p.nombre}</li>)}</ul>
}
```

**Server Actions** (`'use server'`): POST-only entry points. **Always re-verify auth/authz inside each action** — a page-level guard does not protect them. Actions run one at a time (not parallel). After a mutation call `revalidateTag`/`revalidatePath`/`redirect`/`refresh` (these throw control-flow, so code after them won't run). Use `useActionState` (not the old `useFormState`) for state/pending; the action's first param becomes `prevState`.

```ts
'use server'
import { verifySession } from '@/app/_lib/dal'

export async function pagarRenta(prevState: unknown, formData: FormData) {
  const { userId } = await verifySession()           // re-check every time
  // ...mutate, then invalidate
}
```

### Where the Supabase server client lives

The Supabase **server** client (uses cookies/secret keys) must **only** live in Server Components, Route Handlers, or `'use server'` files — **never** in a Client Component. Client Components use a separate browser client (anon key, `NEXT_PUBLIC_*`). Unprefixed env vars are stripped to empty string on the client, so secrets can't leak. `window`/`localStorage` in a `'use server'` function will throw.

---

## 4. Caching / Cache Components — and fresh financial reads

**Enable Cache Components.** Under it, data is **dynamic by default** and you **opt in** to caching with the `'use cache'` directive (the inverse of old Next):

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig
```

Defaults inside a `'use cache'` boundary (when no `cacheLife` is set): **5 min stale (client) / 15 min revalidate (server) / no time expiry**. Notes that bite:
- **Serverless runtime cache does NOT persist across cold starts**; self-hosted in-memory cache does.
- Cache key includes serializable args → **different `tenantId` = different entry** (good for multi-tenancy).
- You **cannot** read `cookies()`/`headers()`/`searchParams` inside `'use cache'`. Read them outside and **pass as arguments**.
- In **development all caching is disabled**, so don't conclude "it's fresh" from `next dev`.

### EXACT pattern: per-tenant payment ledger & admin dashboard must never be stale

**Rule: financial reads have NO `'use cache'`.** Render them inside `<Suspense>` so they run fresh per request while the static shell streams.

```tsx
// app/(tenant)/finanzas/libro/page.tsx
import { Suspense } from 'react'
import { connection } from 'next/server'

export default function LibroPage() {
  return (
    <>
      <CachedNav />                                  {/* cacheable shell */}
      <Suspense fallback={<p>Cargando movimientos…</p>}>
        <LibroEnVivo />                              {/* fresh every request */}
      </Suspense>
    </>
  )
}

async function LibroEnVivo() {
  await connection()                                 // force request-time, never prerendered
  const { userId } = await verifySession()           // tenant scoping happens via RLS (see §8)
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('payments')
    .select('id, amount, created_at')
    .order('created_at', { ascending: false })       // RLS filters to this tenant
  return <Ledger rows={data ?? []} />
}

async function CachedNav() {
  'use cache'
  // import { cacheLife } from 'next/cache'
  cacheLife('hours')
  return <nav>{/* enlaces estáticos */}</nav>
}
```

If you *do* cache a ledger for read-heavy views, key it per tenant and invalidate on write with **`updateTag` (immediate, read-your-own-writes)** — not `revalidateTag` (stale-while-revalidate):

```ts
// read
export async function getLedger(tenantId: string) {
  'use cache'
  // import { cacheTag, cacheLife } from 'next/cache'
  cacheTag(`ledger_${tenantId}`)
  cacheLife('minutes')
  return db.payments(tenantId)
}
// write (Server Action)
'use server'
import { updateTag } from 'next/cache'
export async function recordPayment(tenantId: string, amount: number) {
  await db.insertPayment(tenantId, amount)
  updateTag(`ledger_${tenantId}`)                    // immediate expiry for THIS tenant only
}
```

> For Llave's admin dashboard and any money screen, prefer the **no-`'use cache'` + `connection()`** approach. Stale money is worse than a slightly slower render.

---

## 5. Proxy (replaces middleware) — auth + role gating

**File `proxy.ts`** at project root (or `src/`). Export `proxy` (or default). Runs on the **Node runtime only** (no Edge). One file per project; import modules for logic.

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/app/_lib/session'

const PROTECTED = ['/dashboard', '/finanzas', '/propiedades']
const PUBLIC = ['/', '/login', '/signup']

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const token = req.cookies.get('session')?.value     // read-only cookie check
  const session = await decrypt(token)                // optimistic; NO DB call

  if (PROTECTED.some(p => path.startsWith(p)) && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (session?.role !== 'admin' && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // exclude static/image/api so proxy doesn't run on every asset
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$).*)'],
}
```

Read cookies via `req.cookies.get()/has()/getAll()`; set on a response via `NextResponse.next()` then `response.cookies.set(...)`. `matcher` values must be **static constants** (build-time analysis). Renamed config flags: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. Codemod: `npx @next/codemod@canary middleware-to-proxy .`.

> **Caveat — proxy is NOT the security boundary.** It's an optimistic redirect for UX. The real authorization is **Supabase RLS** (§8), re-checked at every data fetch and inside every Server Action. Refactoring `matcher` or moving a Server Action can silently drop proxy coverage, so never let proxy be the only gate. If you ever need Edge-runtime behavior (Cloudflare workers etc.), proxy can't do it.

---

## 6. Async `cookies()`/`headers()` + `@supabase/ssr` wiring

Both are **async** in 16. `cookies()` can `.get/.getAll/.has/.set/.delete/.toString`, but **`.set`/`.delete` only work in Server Actions or Route Handlers** (not during a Server Component render, and only before streaming starts). `headers()` is read-only.

Wire `@supabase/ssr` with the **`getAll`/`setAll`** cookie interface (the older `get`/`set`/`remove` triple is deprecated):

```ts
// app/_lib/supabase/server.ts
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()               // ← await
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component render — safe to ignore;
            // proxy refresh handles session cookie writes
          }
        },
      },
    }
  )
}
```

```ts
// app/_lib/supabase/client.ts  (browser)
'use client'
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Because Server Component renders can't write cookies, **refresh the Supabase session in `proxy.ts`** (call `supabase.auth.getUser()` there with the same `getAll`/`setAll` shape, writing refreshed cookies onto the `NextResponse`). The `try/catch` above swallows the render-time write attempt.

---

## 7. Metadata / viewport / manifest — installable PWA

- `themeColor` and `colorScheme` moved out of `Metadata` into the **`viewport`** export. `manifest` stays in `Metadata` as a **string URL**.
- Manifest lives at **`app/manifest.ts`** (root `app/` only).
- Icons auto-discovered in `app/`: `favicon.ico`, `icon.png`, `apple-icon.png` (PNG preferred).
- HTTPS required to install in prod; local test with `next dev --experimental-https`. Android shows the install prompt automatically when manifest + HTTPS are valid — don't hand-roll `beforeinstallprompt`.
- `generateViewport` with runtime data **blocks rendering** (no streaming) — keep viewport static.

```ts
// app/layout.tsx
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}
export const metadata: Metadata = {
  title: 'Llave',
  description: 'Gestión de rentas',
  manifest: '/manifest.webmanifest',
}
```

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Llave — Gestión de rentas',
    short_name: 'Llave',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    lang: 'es-MX',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

Service worker (if used) lives at `public/sw.js`; register from a client component with `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })`.

---

## 8. Auth session / Data Access Layer + multi-tenant isolation

Layouts don't re-render on navigation (Partial Rendering), so **verify the session at data-fetch time**, not in a layout. Centralize this in a **Data Access Layer** memoized with React `cache()`.

```ts
// app/_lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/_lib/supabase/server'

export const verifySession = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { userId: user.id }
})
```

Principles: minimal session payload (id + role, no PII); cookies `httpOnly`, `secure`, `sameSite: 'lax'`; return **DTOs** (only the columns the UI needs), never whole rows; `import 'server-only'` on every sensitive module so it can't be bundled to the client.

### RLS is the source of truth

**Supabase RLS is the real multi-tenant boundary.** App-layer `verifySession` and proxy redirects are convenience/UX, not security. Every table is scoped by tenant in the database, so even a bug in the app code can't read another tenant's data.

```sql
-- one policy per table; the DB enforces tenant isolation
alter table payments enable row level security;

create policy "tenant can read own payments"
on payments for select
using ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

create policy "tenant can write own payments"
on payments for insert
with check ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );
```

How it composes: the DAL gives you an authenticated Supabase client carrying the user's JWT (with `tenant_id`); your queries **omit explicit tenant filters and let RLS apply them** (or add them as defense-in-depth). Server Actions re-run `verifySession`, then mutate through the same RLS-guarded client — and **must still check resource ownership** for actions where RLS alone isn't enough (e.g. role checks). Never use the Supabase **service-role key** for tenant-facing queries (it bypasses RLS); reserve it for trusted admin jobs.

---

## 9. Forms, typed routes, strict TS, React Compiler

**Pattern: `react-hook-form` + `zod` on the client, a Server Action + `zod` on the server.** Client validation is UX; **server validation is mandatory** and authoritative.

```tsx
// client: app/(tenant)/propiedades/_components/property-form.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useActionState } from 'react'
import { propertySchema, type PropertyInput } from '../_lib/schema'
import { createProperty } from '../_lib/actions'

export function PropertyForm() {
  const [state, action, pending] = useActionState(createProperty, { errors: {} })
  const { register, formState: { errors } } =
    useForm<PropertyInput>({ resolver: zodResolver(propertySchema) })
  return (
    <form action={action}>
      <input {...register('nombre')} />
      {errors.nombre && <p>{errors.nombre.message}</p>}     {/* client */}
      {state.errors?.nombre && <p>{state.errors.nombre[0]}</p>} {/* server */}
      <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</button>
    </form>
  )
}
```

```ts
// server: app/(tenant)/propiedades/_lib/actions.ts
'use server'
import { propertySchema } from './schema'
import { verifySession } from '@/app/_lib/dal'

export async function createProperty(_prev: unknown, formData: FormData) {
  await verifySession()                                  // re-verify
  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  // ...insert via RLS-guarded client, then revalidateTag(...)
  return { errors: {} }
}
```

Notes:
- The `useActionState` action's **first param is `prevState`** — add it or you get type errors.
- `Object.fromEntries(formData)` includes `$ACTION_*` keys — `zod`'s object parse ignores unknown keys, but be aware. Pass extra (non-form) values via `action.bind(null, x)`, not hidden inputs.
- For **search/filter** navigation use `next/form` (`import Form from 'next/form'`) with a string `action` for prefetching + client-side nav.

**typedRoutes** (now stable, not experimental) and **strict TS**:

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  // reactCompiler: true,   // optional; needs `npm i -D babel-plugin-react-compiler`
}
export default nextConfig
```

```jsonc
// tsconfig.json (essentials)
{ "compilerOptions": { "strict": true }, "include": [".next/types/**/*.ts", "**/*.ts", "**/*.tsx"] }
```

- `typedRoutes` type-checks `Link href` against real routes; cast computed paths with `as Route` (`import type { Route } from 'next'`).
- **React Compiler** is built-in but opt-in via `reactCompiler: true` (global) or `{ compilationMode: 'annotation' }` (only files marked `'use memo'`; opt out with `'use no memo'`). Requires `babel-plugin-react-compiler`. Optional for Phase 0 — adopt once the surface stabilizes.

---

## Phase 0 checklist

- [ ] `next.config.ts`: `cacheComponents: true`, `typedRoutes: true`, top-level `turbopack`, `images.remotePatterns` (Supabase Storage host).
- [ ] Node ≥ 20.9, TS ≥ 5.1, `"strict": true`, `.next/types` in `include`.
- [ ] Route groups `(public)` / `(tenant)` / `(admin)`; every parallel slot has `default.tsx`.
- [ ] `proxy.ts` (not `middleware.ts`) for optimistic auth + role redirects + Supabase session refresh.
- [ ] `@supabase/ssr` server client with `getAll`/`setAll`; `await cookies()` everywhere.
- [ ] DAL with `verifySession` + `cache()`; `import 'server-only'`; DTOs only.
- [ ] **RLS policies on every table** = source of truth; never ship the service-role key to tenant queries.
- [ ] Money screens (ledger, admin dashboard): **no `'use cache'`**, `connection()` + `<Suspense>`.
- [ ] `app/manifest.ts` (es-MX), `viewport.themeColor`, PNG icons, HTTPS for install.
- [ ] Forms: RHF + zod client, Server Action + zod server, `useActionState` with `prevState` first.
