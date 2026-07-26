# Care (Keyholding) — database foundation

This directory holds the **Fase 1** foundation for the Care / keyholding
module described in `keyholding-modul-spec.md`: the full multi-tenant
schema, RLS, and seed data. It is deliberately framework-agnostic — it
applies to any Supabase project regardless of the frontend.

## Schema

The Care module lives in its **own `care` schema** (same Supabase project as
RealtyFlow, isolated like the other brands). Shared CRM objects
(`public.contacts` / `public.brands` / `public.listings`), `auth`, and
`storage` stay in their own schemas; Care references them across schemas.

> **Required Supabase setting:** add `care` under
> **Project Settings → API → Exposed schemas** so PostgREST (supabase-js)
> can reach it. The client selects it with `supabase.schema('care')`.

## Layout

```
supabase/
  migrations/   # ordered DDL, runs top-to-bottom on an empty database
  seed/         # idempotent seed data (run after migrations)
```

### Migrations (apply in order)

| File | Contents |
|------|----------|
| `0001_kh_core_orgs_i18n.sql` | `locales`, CRM stubs (`contacts`/`brands`/`listings` + `contacts.locale`), `orgs`, `org_members`, `current_org_ids()` (security definer), RLS on the tenancy tables |
| `0002_kh_checklist.sql` | Versioned checklist templates, items, item translations |
| `0003_kh_properties_contracts.sql` | `kh_properties`, `kh_plans`, `kh_contracts` |
| `0004_kh_vendors_trades_agreements.sql` | `trades`, vendor register, `kh_fee_model`/`kh_billing_route` enums, `kh_vendor_agreements` |
| `0005_kh_inspections.sql` | `kh_inspections`, items, photos, meter readings (used in Fase 2) |
| `0006_kh_issues_workorders_tokens.sql` | `kh_issues`, `kh_access_tokens`, `kh_work_orders` |
| `0007_kh_reports.sql` | `kh_reports`, `kh_report_deliveries`, per-org report counter (Fase 3) |
| `0008_rls_policies.sql` | `tenant_isolation` on every `kh_` table + global lookup read policies |
| `0009_storage_kh_photos.sql` | Private `kh-photos` bucket + per-org storage RLS |

### Seed (apply after migrations)

| File | Contents |
|------|----------|
| `0001_lookups.sql` | 10 locales, 15-trade taxonomy with no/en/es names |
| `0002_checklist.sql` | `care.seed_default_checklist(org_id)` — provisions the standard 42-point template + no/en/es translations (generated from `checklist-seed.csv`) |
| `0003_demo_org.sql` | Demo org "Zen Eco Homes", three plans, and its checklist |

`supabase/seed/0002_checklist.sql` and `lib/care/data/checklist.json` are
**generated** — regenerate both with:

```bash
npm run gen:checklist-seed -- path/to/checklist-seed.csv
```

## Applying it

With the Supabase CLI (recommended):

```bash
supabase db reset          # applies migrations, then seeds
# or, against a linked project:
supabase migration up
psql "$DATABASE_URL" -f supabase/seed/0001_lookups.sql
psql "$DATABASE_URL" -f supabase/seed/0002_checklist.sql
psql "$DATABASE_URL" -f supabase/seed/0003_demo_org.sql
```

After the schema is live, generate typed bindings and commit them:

```bash
supabase gen types typescript --linked --schema care > lib/care/types/supabase.generated.ts
```

Until then, `lib/care/types/careDb.ts` is the hand-written source of truth.

## Design principles honoured (Fase 1 brief)

1. **Multi-tenant from migration one.** Every `kh_` table has `org_id`,
   RLS enabled, and the identical `tenant_isolation` policy. Isolation is
   enforced in the database, not the app.
2. **Snapshots for anything touching money or legal documents.**
   `template_snapshot`, `plan_snapshot`, `agreement_snapshot`,
   `data_snapshot`.
3. **Language is a property of the recipient.** i18n layer 2 lives in
   `*_translations` tables; layer 3 user content is `jsonb` keyed by
   locale. Fallback order (requested → org default → `en`) is implemented
   once in `lib/care/i18n/resolveTranslation.ts`.
4. **Money is integer cents** with a `currency char(3)`; IVA and IRPF are
   separate columns, never baked into a total.
5. **Nothing goes out without human approval** — modelled via the
   work-order state machine (`lib/care/workorders/stateMachine.ts`).

## Verified locally

All nine migrations + three seed files were applied in order on an empty
PostgreSQL 16 database (with `auth`/`storage` stubs). A two-tenant RLS
test confirmed a user in Org A can read only Org A's rows and that a
cross-tenant write is rejected by the policy. Seed produced 42 items, 126
item translations, 10 locales, 15 trades.

## Fase 2 — the offline inspection app

Built on top of this schema (all client code under `lib/care/inspections/`,
`services/care/`, `pages/InspectionRunner.tsx`):

- **Offline store** — IndexedDB via `idb` (`services/care/inspectionDb.ts`):
  stores `inspections`, `items`, `photos` (Blob), `meter_readings`, `queue`.
  All ids are `crypto.randomUUID()`, so sync is idempotent.
- **Sync engine** (`services/care/syncQueue.ts`) — FIFO queue, exponential
  backoff 1→2→4→8 s capped at 5 min, order
  inspection → items → meters → photos → complete, every write an
  `upsert(onConflict:'id')` into the `care` schema. Runs on `online`, at
  startup, and every 30 s while the queue is non-empty.
- **Photos** (`services/care/photo.ts`) — `browser-image-compression`,
  JPEG, 1600 px, q0.8, EXIF orientation normalised; path
  `kh/{org}/{property}/{inspection}/{photo}.jpg`; Blob dropped only after
  the upload is confirmed.
- **GPS** (`services/care/geo.ts`) — `navigator.geolocation`, never blocks
  the inspection; records `ok`/`low_accuracy`/`denied`/`unavailable`.
- **Pure, tested logic** (`lib/care/inspections/`): leak detection
  (`meterReading.ts`), completion rules (`completion.ts`), deviation→issue
  suggestions with dedupe (`issues.ts`), template snapshot builder, and the
  sync backoff. 72 unit tests total across Fase 1 + Fase 2.

**Service worker:** the brief names Serwist (a Next.js/App-Router tool).
This app is an importmap-based Vite SPA loading modules from esm.sh, so
`public/sw.js` is a hand-written equivalent: it precaches the app shell and
runtime-caches the esm.sh module graph (stale-while-revalidate), and never
caches Supabase REST/storage/auth responses.

## Fase 3 — the report

Turns a finished inspection into an immutable, owner-language PDF.

- **Pure, tested logic** (`lib/care/reports/`): `dataSnapshot.ts` freezes
  everything the report needs, resolved to the owner's locale;
  `reference.ts` (KH-R-yy-seq); `contentHash.ts` (sha256, deterministic via
  key-sorted JSON); `format.ts` (Intl date/number/currency per locale). 17
  tests, incl. locale formatting and hash stability.
- **PDF** (`components/care/ReportDocument.tsx`) — `@react-pdf/renderer`,
  rendered **client-side** (importmap) with header, summary, meter table
  (anomaly highlighted), two-column checklist, photo gallery (deviation
  photos first, broken image → placeholder), open issues, manager comment
  (marked when not in the owner's language), hash footer.
- **Flow** (`services/care/reportService.ts`) — draft → preview any number
  of times → **approve & finalise**: freeze snapshot, compute
  `content_hash` over the frozen snapshot (same snapshot ⇒ same hash),
  render the final PDF, write an immutable local record + best-effort mirror
  to `care.kh_reports` and the PDF to storage. UI in the Care **Rapporter**
  tab.

**content_hash note:** the brief hashes the finished PDF bytes; react-pdf
embeds timestamps that would make that non-deterministic, so we hash the
frozen `data_snapshot` (key-sorted) instead — which satisfies "same
snapshot, same hash" more directly and is printed in the PDF footer.

**Server-side follow-ups (need a backend, like Auth):** Resend email
delivery, the tokened login-free share page with view tracking
(`kh_access_tokens` + `first_viewed_at`/`view_count`), and bounce logging in
`kh_report_deliveries`. The schema for all of this already exists (Fase 1);
the UI shows a placeholder `share_url` and marks it clearly.

## Known gap (carried into Fase 2)

The RealtyFlow app currently authenticates with a **hardcoded credential
check** and runs in localStorage "demo mode"; there is no real Supabase
Auth session, so `auth.uid()` is not populated from the browser. RLS is
correct and proven at the database level, but it only *enforces* isolation
once the app signs users in through Supabase Auth. Wiring that (replacing
`services/authService.ts` with `supabase.auth`) is the first task of the
mobile work in Fase 2. Until then the Care admin UI persists to
localStorage and best-effort-mirrors to Supabase when connected.
