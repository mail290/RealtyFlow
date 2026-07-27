-- ============================================================================
-- Care / Keyholding — complete deploy script for RealtyFlow Pro
-- Project: ereapsfcsqtdmzosgnnn
-- Run this whole file in the Supabase SQL editor (or via psql) ONCE on a
-- fresh project. It creates the `care` schema (32 tables), RLS, the private
-- kh-photos storage bucket, the 42-point checklist function, and seeds
-- locales/trades + the Zen Eco Homes demo org.
--
-- Safe against an existing CRM: public.contacts/brands/listings are created
-- only "if not exists" and only a nullable contacts.locale column is added.
--
-- AFTER RUNNING: add `care` under Settings -> API -> Exposed schemas.
-- ============================================================================

-- ==================== MIGRATIONS ====================
-- =====================================================================
-- Care / Keyholding module — Phase 1 foundation
-- 0001: Care schema, core tenancy, locales (i18n layer 2), CRM stubs
-- =====================================================================
-- The Care module lives in its own `care` schema (same pattern as the
-- other brands in this Supabase project). Shared CRM objects
-- (contacts/brands/listings), auth and storage stay in their own schemas.
--
-- IMPORTANT: add `care` to API → Exposed schemas in Supabase so PostgREST
-- (supabase-js) can reach it via `supabase.schema('care')`.
--
-- This migration is idempotent-friendly and runs on an EMPTY database.
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists care;
grant usage on schema care to authenticated, anon, service_role;
-- New tables in `care` are reachable by the API roles.
alter default privileges in schema care
  grant select, insert, update, delete on tables to authenticated, service_role;

-- ---------------------------------------------------------------------
-- i18n layer 2 — system content locales (delivered translated by us)
-- ---------------------------------------------------------------------
create table if not exists care.locales (
  code    text primary key,
  name_en text not null,
  rtl     boolean not null default false
);

-- ---------------------------------------------------------------------
-- Shared CRM objects (stubs in public — reused across CRM and Care).
-- Created only if the CRM has not already defined them.
-- ---------------------------------------------------------------------
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  full_name  text,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  created_at timestamptz not null default now()
);

-- `contacts.locale` decides the report language for the owner (Principle 3).
alter table public.contacts
  add column if not exists locale text references care.locales(code);

-- ---------------------------------------------------------------------
-- Organisations & membership
-- ---------------------------------------------------------------------
create table if not exists care.orgs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  default_locale    text not null references care.locales(code),
  supported_locales text[] not null default '{en}',
  currency          char(3) not null default 'EUR',
  timezone          text not null default 'Europe/Madrid',
  country           char(2) not null default 'ES',
  water_leak_lpd    numeric(12,3) not null default 20,   -- litres/day, empty home
  power_leak_kwhpd  numeric(12,3) not null default 3,    -- kWh/day, empty home
  created_at        timestamptz not null default now()
);

create table if not exists care.org_members (
  org_id     uuid not null references care.orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','admin','inspector','viewer')),
  locale     text references care.locales(code),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_org_members_user on care.org_members(user_id);

-- ---------------------------------------------------------------------
-- RLS helper. security definer so evaluating the policy on org_members
-- does not recurse into org_members' own RLS policy.
-- ---------------------------------------------------------------------
create or replace function care.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = care, public
as $$
  select org_id from care.org_members where user_id = auth.uid()
$$;
grant execute on function care.current_org_ids() to authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- RLS on the tenancy tables themselves.
-- ---------------------------------------------------------------------
alter table care.orgs enable row level security;
drop policy if exists tenant_isolation on care.orgs;
create policy tenant_isolation on care.orgs
  using (id in (select care.current_org_ids()))
  with check (id in (select care.current_org_ids()));

alter table care.org_members enable row level security;
drop policy if exists tenant_isolation on care.org_members;
create policy tenant_isolation on care.org_members
  using (org_id in (select care.current_org_ids()))
  with check (org_id in (select care.current_org_ids()));
-- =====================================================================
-- 0002: Checklist templates, items and item translations (i18n layer 2)
-- =====================================================================
-- Principle 2: the checklist is versioned. A report always renders with
-- the checklist as it was when the inspection was performed.
-- =====================================================================

create table care.kh_checklist_templates (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references care.orgs(id) on delete cascade,
  code           text not null,                 -- e.g. 'standard'
  version        int  not null default 1,
  name           text not null,
  property_types text[] not null default '{apartment,townhouse,villa,finca}',
  min_photos     int  not null default 14,      -- enforced at completion (Phase 2)
  is_active      boolean not null default true,
  active_from    date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (org_id, code, version)
);

create index idx_kh_checklist_templates_org on care.kh_checklist_templates(org_id);
create unique index idx_kh_checklist_templates_active
  on care.kh_checklist_templates(org_id, code)
  where is_active;

create table care.kh_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references care.orgs(id) on delete cascade,
  template_id    uuid not null references care.kh_checklist_templates(id) on delete cascade,
  code           text not null,                 -- 'water.trap_kitchen' — stable, never edit
  sort_order     int  not null,
  category       text not null,
  requires_photo boolean not null default false,
  requires_value boolean not null default false,
  value_unit     text,                          -- 'm3','kWh','C','pct','count'
  applies_to     text[] not null default '{apartment,townhouse,villa,finca}',
  is_automatic   boolean not null default false,-- items 1 & 42 filled by check-in/out
  is_system      boolean not null default true,
  unique (template_id, code)
);

create index idx_kh_checklist_items_org on care.kh_checklist_items(org_id);
create index idx_kh_checklist_items_template on care.kh_checklist_items(template_id, sort_order);

create table care.kh_checklist_item_translations (
  item_id   uuid not null references care.kh_checklist_items(id) on delete cascade,
  locale    text not null references care.locales(code),
  title     text not null,
  help_text text,
  primary key (item_id, locale)
);
-- =====================================================================
-- 0003: Properties under management, plans and contracts
-- =====================================================================
-- Principle 4: money as integer minor units (bigint cents) + currency.
-- =====================================================================

create table care.kh_properties (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  brand_id      uuid references public.brands(id),
  owner_id      uuid not null references public.contacts(id),
  listing_id    uuid references public.listings(id),  -- if also for sale
  reference     text not null,                        -- KH-0001, unique per org
  property_type text not null check (property_type in ('apartment','townhouse','villa','finca')),
  name          text,
  address_line  text not null,
  municipality  text not null,
  postcode      text,
  country       char(2) not null default 'ES',
  lat           numeric(9,6),
  lng           numeric(9,6),
  has_pool      boolean not null default false,
  has_garden    boolean not null default false,
  access_notes  jsonb,                                -- gate code, alarm, parking
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  unique (org_id, reference)
);

create index idx_kh_properties_org on care.kh_properties(org_id);
create index idx_kh_properties_owner on care.kh_properties(org_id, owner_id);

-- Plans are per organisation, not global — each SaaS tenant sets its own.
create table care.kh_plans (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references care.orgs(id) on delete cascade,
  code              text not null,
  name              text,
  visits_per_month  int  not null,
  price_cents       bigint not null,
  currency          char(3) not null default 'EUR',
  included_services text[] not null default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (org_id, code)
);

create index idx_kh_plans_org on care.kh_plans(org_id);

create table care.kh_contracts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  property_id   uuid not null references care.kh_properties(id) on delete cascade,
  plan_id       uuid not null references care.kh_plans(id),
  plan_snapshot jsonb not null,                       -- Principle 2 — frozen plan terms
  starts_on     date not null,
  ends_on       date,
  billing_day   int not null default 1,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

create index idx_kh_contracts_org on care.kh_contracts(org_id);
create index idx_kh_contracts_property on care.kh_contracts(org_id, property_id);
-- =====================================================================
-- 0004: Trade taxonomy, vendor register and vendor agreements
-- =====================================================================

create table care.trades (
  code       text primary key,   -- 'plumbing','electrical','pool',...
  sort_order int not null
);

create table care.trade_translations (
  trade_code text not null references care.trades(code) on delete cascade,
  locale     text not null references care.locales(code),
  name       text not null,
  primary key (trade_code, locale)
);

create table care.kh_vendors (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references care.orgs(id) on delete cascade,
  company_name     text not null,
  contact_name     text,
  email            text,
  phone            text,
  whatsapp         text,                              -- primary channel in Spain
  tax_id           text,                              -- NIF/CIF
  locales          text[] not null default '{es}',    -- languages they actually read
  preferred_locale text not null default 'es',
  service_areas    text[] not null default '{}',      -- municipalities
  is_preferred     boolean not null default false,
  insurance_expires_on date,
  rating           numeric(2,1),
  notes            jsonb,
  status           text not null default 'active',
  created_at       timestamptz not null default now()
);

create index idx_kh_vendors_org on care.kh_vendors(org_id);

create table care.kh_vendor_trades (
  org_id     uuid not null references care.orgs(id) on delete cascade,
  vendor_id  uuid not null references care.kh_vendors(id) on delete cascade,
  trade_code text not null references care.trades(code),
  primary key (vendor_id, trade_code)
);

create index idx_kh_vendor_trades_org on care.kh_vendor_trades(org_id);
create index idx_kh_vendor_trades_trade on care.kh_vendor_trades(trade_code);

create type care.kh_fee_model as enum
  ('commission_on_vendor','markup_on_cost','fixed_fee','hourly_coordination','none');
create type care.kh_billing_route as enum
  ('agency_reinvoices','vendor_invoices_owner');

create table care.kh_vendor_agreements (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references care.orgs(id) on delete cascade,
  vendor_id                uuid not null references care.kh_vendors(id) on delete cascade,
  fee_model                care.kh_fee_model not null,
  billing_route            care.kh_billing_route not null,
  fee_pct                  numeric(5,2),
  fee_fixed_cents          bigint,
  fee_min_cents            bigint,
  fee_max_cents            bigint,
  callout_fee_cents        bigint,
  hourly_rate_cents        bigint,
  iva_pct                  numeric(5,2) not null default 21.00,
  irpf_pct                 numeric(5,2) not null default 0,   -- Spanish autónomo retención
  payment_terms_days       int not null default 30,
  auto_approve_under_cents bigint,
  valid_from               date not null,
  valid_to                 date,
  currency                 char(3) not null default 'EUR',
  created_at               timestamptz not null default now()
);

create index idx_kh_vendor_agreements_org on care.kh_vendor_agreements(org_id);
create index idx_kh_vendor_agreements_vendor on care.kh_vendor_agreements(org_id, vendor_id);
-- =====================================================================
-- 0005: Inspections, inspection items, photos, meter readings
-- =====================================================================
-- All ids are client-generated (crypto.randomUUID) so offline sync is
-- idempotent via upsert on the primary key.
-- =====================================================================

create table care.kh_inspections (
  id                  uuid primary key,          -- client-generated
  org_id              uuid not null references care.orgs(id) on delete cascade,
  property_id         uuid not null references care.kh_properties(id),
  contract_id         uuid references care.kh_contracts(id),
  template_id         uuid not null references care.kh_checklist_templates(id),
  template_snapshot   jsonb not null,            -- Principle 2 — frozen template + translations
  inspector_id        uuid not null references auth.users(id),
  kind                text not null default 'scheduled'
                      check (kind in ('scheduled','storm','pre_arrival','post_departure','ad_hoc')),
  is_billable         boolean not null default true,
  status              text not null default 'draft'
                      check (status in ('draft','completed','synced','reported')),
  started_at          timestamptz not null,
  completed_at        timestamptz,               -- set from now() on server at sync
  device_completed_at timestamptz,               -- client clock, may be wrong
  synced_at           timestamptz,
  start_lat           numeric(9,6),
  start_lng           numeric(9,6),
  start_accuracy_m    int,
  end_lat             numeric(9,6),
  end_lng             numeric(9,6),
  gps_status          text not null default 'ok'
                      check (gps_status in ('ok','low_accuracy','denied','unavailable')),
  occupied_in_period  boolean,                   -- manual answer (calendar comes in Phase 4)
  comment             jsonb,
  photo_count         int not null default 0,
  created_at          timestamptz not null default now()
);

create index idx_kh_inspections_org on care.kh_inspections(org_id);
create index idx_kh_inspections_property on care.kh_inspections(org_id, property_id, started_at desc);

create table care.kh_inspection_items (
  id            uuid primary key,                -- client-generated
  org_id        uuid not null references care.orgs(id) on delete cascade,
  inspection_id uuid not null references care.kh_inspections(id) on delete cascade,
  item_code     text not null,                   -- against template_snapshot, NOT a FK
  status        text not null
                check (status in ('ok','deviation','not_applicable','not_checked')),
  value_numeric numeric(12,3),
  value_unit    text,
  note          jsonb,
  recorded_at   timestamptz not null,
  unique (inspection_id, item_code)
);

create index idx_kh_inspection_items_org on care.kh_inspection_items(org_id);
create index idx_kh_inspection_items_inspection on care.kh_inspection_items(inspection_id);

create table care.kh_photos (
  id            uuid primary key,                -- client-generated
  org_id        uuid not null references care.orgs(id) on delete cascade,
  inspection_id uuid not null references care.kh_inspections(id) on delete cascade,
  item_code     text,
  storage_path  text not null,                   -- kh/{org}/{property}/{inspection}/{photo}.jpg
  width         int,
  height        int,
  bytes         int,
  taken_at      timestamptz not null,
  sort_order    int not null default 0,
  caption       jsonb
);

create index idx_kh_photos_org on care.kh_photos(org_id);
create index idx_kh_photos_inspection on care.kh_photos(inspection_id);

create table care.kh_meter_readings (
  id             uuid primary key,               -- client-generated
  org_id         uuid not null references care.orgs(id) on delete cascade,
  property_id    uuid not null references care.kh_properties(id) on delete cascade,
  inspection_id  uuid references care.kh_inspections(id) on delete set null,
  meter_type     text not null check (meter_type in ('water','electricity','gas')),
  reading        numeric(12,3) not null,
  unit           text not null,
  read_at        timestamptz not null,
  previous_id    uuid references care.kh_meter_readings(id),
  delta          numeric(12,3),
  days_elapsed   numeric(8,2),
  per_day        numeric(12,4),
  is_anomaly     boolean not null default false,
  meter_replaced boolean not null default false
);

create index idx_kh_meter_readings_org on care.kh_meter_readings(org_id);
create index idx_kh_meter_readings_lookup
  on care.kh_meter_readings(property_id, meter_type, read_at desc);
-- =====================================================================
-- 0006: Issues, work orders and passwordless access tokens
-- =====================================================================

create table care.kh_issues (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  property_id   uuid not null references care.kh_properties(id) on delete cascade,
  inspection_id uuid references care.kh_inspections(id),
  item_code     text,
  severity      text not null check (severity in ('info','low','medium','high','urgent')),
  title         jsonb not null,                  -- i18n layer 3 (author's language)
  description   jsonb,
  trade_code    text references care.trades(code),
  status        text not null default 'open'
                check (status in ('open','in_progress','closed')),
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz
);

create index idx_kh_issues_org on care.kh_issues(org_id);
create index idx_kh_issues_property on care.kh_issues(org_id, property_id, status);

create table care.kh_access_tokens (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references care.orgs(id) on delete cascade,
  token_hash  text not null unique,              -- sha256, never store raw token
  scope       text not null,                     -- 'report:view','workorder:respond'
  subject_id  uuid not null,
  locale      text not null references care.locales(code),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_kh_access_tokens_org on care.kh_access_tokens(org_id);

create table care.kh_work_orders (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references care.orgs(id) on delete cascade,
  property_id        uuid not null references care.kh_properties(id),
  issue_id           uuid references care.kh_issues(id),
  vendor_id          uuid references care.kh_vendors(id),
  agreement_id       uuid references care.kh_vendor_agreements(id),
  agreement_snapshot jsonb,                       -- Principle 2
  reference          text not null,               -- WO-26-0001, unique per org
  status             text not null default 'draft',
  vendor_locale      text not null,
  description        jsonb not null,              -- i18n layer 3
  budget_cap_cents   bigint,
  owner_approved_at  timestamptz,
  owner_approved_by  uuid references public.contacts(id),
  scheduled_for      date,
  completed_at       timestamptz,
  vendor_net_cents   bigint,
  vendor_iva_cents   bigint,
  vendor_irpf_cents  bigint,
  vendor_total_cents bigint,
  fee_cents          bigint,
  owner_net_cents    bigint,
  owner_iva_cents    bigint,
  owner_total_cents  bigint,
  currency           char(3) not null default 'EUR',
  created_at         timestamptz not null default now(),
  unique (org_id, reference)
);

create index idx_kh_work_orders_org on care.kh_work_orders(org_id);
create index idx_kh_work_orders_property on care.kh_work_orders(org_id, property_id);
-- =====================================================================
-- 0007: Reports and report deliveries (schema now, used in Phase 3)
-- =====================================================================

create table care.kh_reports (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references care.orgs(id) on delete cascade,
  inspection_id   uuid not null references care.kh_inspections(id) on delete cascade,
  property_id     uuid not null references care.kh_properties(id),
  reference       text not null,                 -- KH-R-26-0001
  locale          text not null references care.locales(code),
  storage_path    text not null,
  bytes           int,
  content_hash    text not null,                 -- sha256 of the PDF
  version         int not null default 1,
  status          text not null default 'draft'
                  check (status in ('draft','approved','sent','viewed')),
  data_snapshot   jsonb not null,                -- everything the report needs, frozen
  approved_at     timestamptz,
  approved_by     uuid references auth.users(id),
  sent_at         timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  view_count      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (org_id, reference)
);

create index idx_kh_reports_org on care.kh_reports(org_id);
create index idx_kh_reports_inspection on care.kh_reports(inspection_id);

create table care.kh_report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references care.orgs(id) on delete cascade,
  report_id   uuid not null references care.kh_reports(id) on delete cascade,
  channel     text not null check (channel in ('email','whatsapp','manual')),
  recipient   text not null,
  token_id    uuid references care.kh_access_tokens(id),
  sent_at     timestamptz not null default now(),
  provider_id text,                              -- Resend message-id
  status      text not null default 'sent'
              check (status in ('sent','delivered','bounced','failed'))
);

create index idx_kh_report_deliveries_org on care.kh_report_deliveries(org_id);
create index idx_kh_report_deliveries_report on care.kh_report_deliveries(report_id);

create table care.kh_report_counters (
  org_id     uuid not null references care.orgs(id) on delete cascade,
  year       int  not null,
  last_value int  not null default 0,
  primary key (org_id, year)
);
-- =====================================================================
-- 0008: Row Level Security — tenant isolation on every care table
-- =====================================================================
-- Principle 1: RLS is enforced in the database, not the application.
-- care.orgs / care.org_members already got their policies in 0001.
-- =====================================================================

do $$
declare
  t text;
  org_scoped text[] := array[
    'kh_checklist_templates',
    'kh_checklist_items',
    'kh_properties',
    'kh_plans',
    'kh_contracts',
    'kh_vendors',
    'kh_vendor_trades',
    'kh_vendor_agreements',
    'kh_inspections',
    'kh_inspection_items',
    'kh_photos',
    'kh_meter_readings',
    'kh_issues',
    'kh_access_tokens',
    'kh_work_orders',
    'kh_reports',
    'kh_report_deliveries',
    'kh_report_counters'
  ];
begin
  foreach t in array org_scoped loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on care.%I', t);
    execute format(
      'create policy tenant_isolation on care.%I '
      'using (org_id in (select care.current_org_ids())) '
      'with check (org_id in (select care.current_org_ids()))', t);
  end loop;
end $$;

-- kh_checklist_item_translations has no org_id; it inherits isolation from
-- its parent item.
alter table care.kh_checklist_item_translations enable row level security;
drop policy if exists tenant_isolation on care.kh_checklist_item_translations;
create policy tenant_isolation on care.kh_checklist_item_translations
  using (
    exists (
      select 1 from care.kh_checklist_items i
      where i.id = kh_checklist_item_translations.item_id
        and i.org_id in (select care.current_org_ids())
    )
  )
  with check (
    exists (
      select 1 from care.kh_checklist_items i
      where i.id = kh_checklist_item_translations.item_id
        and i.org_id in (select care.current_org_ids())
    )
  );

-- Global system content (i18n layer 2) is readable by any authenticated
-- user; writes are reserved for the service role (which bypasses RLS).
do $$
declare
  t text;
  global_lookup text[] := array['locales','trades','trade_translations'];
begin
  foreach t in array global_lookup loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists read_all_authenticated on care.%I', t);
    execute format(
      'create policy read_all_authenticated on care.%I '
      'for select to authenticated using (true)', t);
  end loop;
end $$;

-- NOTE: public.contacts / brands / listings are shared CRM objects governed
-- by the CRM's own RLS. They are intentionally NOT given Care policies here.
-- =====================================================================
-- 0009: Private storage bucket for inspection photos
-- =====================================================================
-- Path layout: kh/{org_id}/{property_id}/{inspection_id}/{photo_id}.jpg
-- A path is only readable/writable by members of the org whose id is the
-- {org_id} segment (2nd path segment).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('kh-photos', 'kh-photos', false)
on conflict (id) do nothing;

drop policy if exists kh_photos_tenant_read on storage.objects;
create policy kh_photos_tenant_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select care.current_org_ids())
  );

drop policy if exists kh_photos_tenant_insert on storage.objects;
create policy kh_photos_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select care.current_org_ids())
  );

drop policy if exists kh_photos_tenant_update on storage.objects;
create policy kh_photos_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select care.current_org_ids())
  );

drop policy if exists kh_photos_tenant_delete on storage.objects;
create policy kh_photos_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select care.current_org_ids())
  );
-- =====================================================================
-- 0010: Calendar (Fase 4) and key log (core keyholding)
-- =====================================================================
-- The site promises "full log of every key handover" — keys get their own
-- log, not a notes field. The calendar drives automatic inspection
-- scheduling, stays, prep tasks and storm callouts.
-- =====================================================================

create table care.kh_calendar_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  property_id   uuid not null references care.kh_properties(id) on delete cascade,
  event_type    text not null check (event_type in
                  ('owner_stay','guest_stay','inspection','service_visit','prep_task','storm_callout')),
  title         text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  all_day       boolean not null default false,
  guest_name    text,                              -- for guest_stay (GDPR: anonymisable)
  inspection_id uuid references care.kh_inspections(id) on delete set null,
  work_order_id uuid references care.kh_work_orders(id) on delete set null,
  is_billable   boolean not null default true,     -- storm callouts are not billable
  status        text not null default 'planned'
                check (status in ('planned','done','cancelled')),
  source        text not null default 'manual'     -- 'manual' | 'auto' (plan-generated)
                check (source in ('manual','auto')),
  notes         jsonb,
  created_at    timestamptz not null default now()
);

create index idx_kh_calendar_events_org on care.kh_calendar_events(org_id);
create index idx_kh_calendar_events_property on care.kh_calendar_events(org_id, property_id, starts_at);

-- ---------------------------------------------------------------------
-- Keys and their handover log
-- ---------------------------------------------------------------------
create table care.kh_keys (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  property_id   uuid not null references care.kh_properties(id) on delete cascade,
  label         text not null,                     -- 'Hovednøkkel', 'Portnøkkel'
  storage_location text,                            -- safe / box location
  code          text,                              -- gate/safe code (sensitive)
  status        text not null default 'in_office'
                check (status in ('in_office','with_holder','lost','retired')),
  created_at    timestamptz not null default now()
);

create index idx_kh_keys_org on care.kh_keys(org_id);
create index idx_kh_keys_property on care.kh_keys(org_id, property_id);

create table care.kh_key_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references care.orgs(id) on delete cascade,
  key_id         uuid not null references care.kh_keys(id) on delete cascade,
  property_id    uuid not null references care.kh_properties(id) on delete cascade,
  action         text not null check (action in ('checked_out','checked_in')),
  holder_name    text,                             -- who took/returned it
  holder_contact_id uuid references public.contacts(id),
  reason         text,
  at             timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index idx_kh_key_events_org on care.kh_key_events(org_id);
create index idx_kh_key_events_key on care.kh_key_events(key_id, at desc);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['kh_calendar_events','kh_keys','kh_key_events'] loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on care.%I', t);
    execute format(
      'create policy tenant_isolation on care.%I '
      'using (org_id in (select care.current_org_ids())) '
      'with check (org_id in (select care.current_org_ids()))', t);
  end loop;
end $$;
-- =====================================================================
-- 0011: Property documents (Fase 5 — owner portal, escritura/IBI/insurance)
-- =====================================================================

create table care.kh_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references care.orgs(id) on delete cascade,
  property_id  uuid not null references care.kh_properties(id) on delete cascade,
  doc_type     text not null check (doc_type in
                 ('escritura','insurance','ibi','community_rules','contract','energy_cert','other')),
  title        text not null,
  storage_path text not null,
  issued_on    date,
  expires_on   date,                               -- e.g. insurance renewal
  visible_to_owner boolean not null default true,  -- owner-portal visibility
  created_at   timestamptz not null default now()
);

create index idx_kh_documents_org on care.kh_documents(org_id);
create index idx_kh_documents_property on care.kh_documents(org_id, property_id);

alter table care.kh_documents enable row level security;
drop policy if exists tenant_isolation on care.kh_documents;
create policy tenant_isolation on care.kh_documents
  using (org_id in (select care.current_org_ids()))
  with check (org_id in (select care.current_org_ids()));
-- =====================================================================
-- 0012: Charges and invoices (Fase 6)
-- =====================================================================
-- Principle 4: money as integer cents; IVA and IRPF as separate columns.
-- Spanish invoicing needs the org NIF, gap-free sequential numbering, and
-- (likely) Verifactu — confirm the number series with the gestor before
-- going live. The structure is here; the fiscal integration is not.
-- =====================================================================

-- Org billing identity (extends care.orgs without touching the base table).
alter table care.orgs add column if not exists nif text;
alter table care.orgs add column if not exists legal_name text;
alter table care.orgs add column if not exists invoice_prefix text default 'INV';

create table care.kh_charges (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references care.orgs(id) on delete cascade,
  property_id  uuid not null references care.kh_properties(id) on delete cascade,
  contract_id  uuid references care.kh_contracts(id) on delete set null,
  description  text not null,                       -- 'Posthenting', 'Meet & greet'
  kind         text not null default 'addon',
  quantity     numeric(10,2) not null default 1,
  unit_cents   bigint not null,                     -- price per unit, minor units
  amount_cents bigint not null,                     -- quantity * unit_cents (frozen)
  currency     char(3) not null default 'EUR',
  occurred_on  date not null default current_date,
  status       text not null default 'open'
               check (status in ('open','invoiced','void')),
  invoice_id   uuid,                                -- set when rolled into an invoice
  created_at   timestamptz not null default now()
);

create index idx_kh_charges_org on care.kh_charges(org_id);
create index idx_kh_charges_property on care.kh_charges(org_id, property_id, status);

create table care.kh_invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references care.orgs(id) on delete cascade,
  property_id   uuid not null references care.kh_properties(id),
  contract_id   uuid references care.kh_contracts(id),
  reference     text not null,                      -- INV-26-0001, gap-free per org
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'draft'
                check (status in ('draft','approved','sent','paid','void')),
  currency      char(3) not null default 'EUR',
  fixed_cents   bigint not null default 0,          -- plan monthly amount
  charges_cents bigint not null default 0,          -- sum of add-on charges
  subtotal_cents bigint not null default 0,
  iva_pct       numeric(5,2) not null default 21.00,
  iva_cents     bigint not null default 0,
  irpf_pct      numeric(5,2) not null default 0,
  irpf_cents    bigint not null default 0,
  total_cents   bigint not null default 0,
  issued_on     date,
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (org_id, reference)
);

create index idx_kh_invoices_org on care.kh_invoices(org_id);
create index idx_kh_invoices_property on care.kh_invoices(org_id, property_id);

create table care.kh_invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references care.orgs(id) on delete cascade,
  invoice_id  uuid not null references care.kh_invoices(id) on delete cascade,
  line_type   text not null check (line_type in ('plan','charge')),
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_cents  bigint not null,
  amount_cents bigint not null,
  charge_id   uuid references care.kh_charges(id),
  sort_order  int not null default 0
);

create index idx_kh_invoice_lines_org on care.kh_invoice_lines(org_id);
create index idx_kh_invoice_lines_invoice on care.kh_invoice_lines(invoice_id, sort_order);

-- per-org, per-year invoice sequence (gap-free requirement).
create table care.kh_invoice_counters (
  org_id     uuid not null references care.orgs(id) on delete cascade,
  year       int  not null,
  last_value int  not null default 0,
  primary key (org_id, year)
);

-- FK from charges to invoices (declared after both tables exist).
alter table care.kh_charges
  add constraint kh_charges_invoice_fk
  foreign key (invoice_id) references care.kh_invoices(id) on delete set null;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['kh_charges','kh_invoices','kh_invoice_lines','kh_invoice_counters'] loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on care.%I', t);
    execute format(
      'create policy tenant_isolation on care.%I '
      'using (org_id in (select care.current_org_ids())) '
      'with check (org_id in (select care.current_org_ids()))', t);
  end loop;
end $$;

-- ==================== SEED: lookups ====================
-- =====================================================================
-- Seed: locales (i18n layer 2) and trade taxonomy with no/en/es names
-- =====================================================================

insert into care.locales (code, name_en, rtl) values
  ('no', 'Norwegian', false),
  ('en', 'English',   false),
  ('es', 'Spanish',   false),
  ('de', 'German',    false),
  ('nl', 'Dutch',     false),
  ('sv', 'Swedish',   false),
  ('da', 'Danish',    false),
  ('fr', 'French',    false),
  ('pt', 'Portuguese',false),
  ('el', 'Greek',     false)
on conflict (code) do nothing;

insert into care.trades (code, sort_order) values
  ('plumbing', 1),
  ('electrical', 2),
  ('hvac', 3),
  ('pool', 4),
  ('gardening', 5),
  ('awnings', 6),
  ('glazing', 7),
  ('locksmith', 8),
  ('cleaning', 9),
  ('pest_control', 10),
  ('roofing', 11),
  ('painting', 12),
  ('appliances', 13),
  ('alarm_security', 14),
  ('general', 15)
on conflict (code) do nothing;

-- Spanish names reviewed-pending: trade terminology (vannlås/sluk/rejas)
-- should be checked by a native speaker before production, per Phase 1 brief.
insert into care.trade_translations (trade_code, locale, name) values
  ('plumbing','no','Rørlegger'),          ('plumbing','en','Plumbing'),            ('plumbing','es','Fontanería'),
  ('electrical','no','Elektriker'),        ('electrical','en','Electrical'),        ('electrical','es','Electricidad'),
  ('hvac','no','Klima og ventilasjon'),    ('hvac','en','HVAC'),                    ('hvac','es','Climatización'),
  ('pool','no','Basseng'),                 ('pool','en','Pool'),                    ('pool','es','Piscina'),
  ('gardening','no','Hage og grønt'),      ('gardening','en','Gardening'),          ('gardening','es','Jardinería'),
  ('awnings','no','Markiser og persienner'),('awnings','en','Awnings and blinds'),  ('awnings','es','Toldos y persianas'),
  ('glazing','no','Glass og vinduer'),     ('glazing','en','Glazing'),              ('glazing','es','Cristalería'),
  ('locksmith','no','Låsesmed'),           ('locksmith','en','Locksmith'),          ('locksmith','es','Cerrajería'),
  ('cleaning','no','Renhold'),             ('cleaning','en','Cleaning'),            ('cleaning','es','Limpieza'),
  ('pest_control','no','Skadedyrkontroll'),('pest_control','en','Pest control'),    ('pest_control','es','Control de plagas'),
  ('roofing','no','Tak og takrenner'),     ('roofing','en','Roofing'),              ('roofing','es','Tejados'),
  ('painting','no','Maler'),               ('painting','en','Painting'),            ('painting','es','Pintura'),
  ('appliances','no','Hvitevarer'),        ('appliances','en','Appliances'),        ('appliances','es','Electrodomésticos'),
  ('alarm_security','no','Alarm og sikkerhet'),('alarm_security','en','Alarm and security'),('alarm_security','es','Alarma y seguridad'),
  ('general','no','Generelt'),             ('general','en','General'),              ('general','es','General')
on conflict (trade_code, locale) do nothing;

-- ==================== SEED: 42-point checklist function ====================
-- =====================================================================
-- Seed: standard 42-point checklist (generated from checklist-seed.csv)
-- Do not edit by hand — regenerate via scripts/gen_checklist_seed.mjs
-- =====================================================================
-- Checklist items carry org_id (Principle 1), so the template is created
-- per organisation. This reusable function provisions the standard
-- template for any org (used at seed time and when onboarding a new
-- SaaS tenant). Editing an item later means bumping to a new version;
-- this function always creates version 1 of code 'standard'.
-- =====================================================================

create or replace function care.seed_default_checklist(p_org_id uuid)
returns uuid
language plpgsql
as $fn$
declare
  v_template_id uuid;
  v_item_id     uuid;
begin
  insert into care.kh_checklist_templates(
      org_id, code, version, name, property_types, min_photos, is_active)
    values (
      p_org_id, 'standard', 1, 'Standard 42-punkts tilsyn',
      '{apartment,townhouse,villa,finca}', 14, true)
    returning id into v_template_id;

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'arrival.checkin', 1, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', true)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Ankomst registrert — GPS og klokkeslett'),
    (v_item_id, 'en', 'Arrival registered — GPS and time'),
    (v_item_id, 'es', 'Llegada registrada — GPS y hora');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.facade', 2, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Fasade og yttervegger — sprekker og fuktmerker'),
    (v_item_id, 'en', 'Façade and exterior walls — cracks and damp marks'),
    (v_item_id, 'es', 'Fachada y muros exteriores — grietas y manchas de humedad');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.roof_gutters', 3, 'arrival_exterior',
      false, false, null, '{townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Tak, takrenner og nedløp'),
    (v_item_id, 'en', 'Roof, gutters and downpipes'),
    (v_item_id, 'es', 'Tejado, canalones y bajantes');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.terrace', 4, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Terrasse og utegulv — løse fliser og avrenning'),
    (v_item_id, 'en', 'Terrace and outdoor flooring — loose tiles and drainage'),
    (v_item_id, 'es', 'Terraza y suelos exteriores — baldosas sueltas y desagüe');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.furniture', 5, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Utemøbler, parasoll og puter — sikret'),
    (v_item_id, 'en', 'Outdoor furniture, parasol and cushions — secured'),
    (v_item_id, 'es', 'Mobiliario de exterior, sombrilla y cojines — asegurados');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.awnings', 6, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Markiser og utvendige persienner'),
    (v_item_id, 'en', 'Awnings and external blinds'),
    (v_item_id, 'es', 'Toldos y persianas exteriores');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.garden', 7, 'arrival_exterior',
      false, false, null, '{townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Hage, potteplanter og vanningsanlegg'),
    (v_item_id, 'en', 'Garden, potted plants and irrigation'),
    (v_item_id, 'es', 'Jardín, plantas en maceta y sistema de riego');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.entrance_door', 8, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Inngangsdør, lås og sylinder'),
    (v_item_id, 'en', 'Entrance door, lock and cylinder'),
    (v_item_id, 'es', 'Puerta de entrada, cerradura y bombín');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.rejas', 9, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Rejas og sikkerhetsgitter'),
    (v_item_id, 'en', 'Security bars (rejas)'),
    (v_item_id, 'es', 'Rejas de seguridad');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.windows', 10, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vinduer og balkongdører — lukket og låst'),
    (v_item_id, 'en', 'Windows and balcony doors — closed and locked'),
    (v_item_id, 'es', 'Ventanas y puertas de balcón — cerradas y con llave');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.alarm', 11, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Alarm — status, testsignal og batterinivå'),
    (v_item_id, 'en', 'Alarm — status, test signal and battery level'),
    (v_item_id, 'es', 'Alarma — estado, señal de prueba y nivel de batería');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.sensors', 12, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Bevegelses- og dørsensorer'),
    (v_item_id, 'en', 'Motion and door sensors'),
    (v_item_id, 'es', 'Sensores de movimiento y de puerta');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.advertising', 13, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Reklame, aviser og pakkelapper fjernet'),
    (v_item_id, 'en', 'Advertising, newspapers and parcel notes removed'),
    (v_item_id, 'es', 'Publicidad, periódicos y avisos de paquetería retirados');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.intrusion', 14, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Spor etter innbruddsforsøk eller uvedkommende'),
    (v_item_id, 'en', 'Signs of attempted intrusion or trespass'),
    (v_item_id, 'es', 'Indicios de intento de robo o intrusión');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.collected', 15, 'mail_documents',
      false, true, 'count', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Postkasse tømt — antall forsendelser'),
    (v_item_id, 'en', 'Mailbox emptied — number of items'),
    (v_item_id, 'es', 'Buzón vaciado — número de envíos');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.official', 16, 'mail_documents',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Post fra ayuntamiento, Suma, forsikring eller sameie'),
    (v_item_id, 'en', 'Mail from town hall, Suma, insurer or community'),
    (v_item_id, 'es', 'Correo del ayuntamiento, Suma, aseguradora o comunidad');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.scanned', 17, 'mail_documents',
      true, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Fristbelagte brev skannet og lastet opp'),
    (v_item_id, 'en', 'Time-sensitive letters scanned and uploaded'),
    (v_item_id, 'es', 'Cartas con plazo escaneadas y subidas');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_kitchen', 18, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås kjøkken — fylt'),
    (v_item_id, 'en', 'Kitchen drain trap — filled'),
    (v_item_id, 'es', 'Sifón de la cocina — lleno');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_bath1', 19, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås bad 1 — fylt'),
    (v_item_id, 'en', 'Bathroom 1 drain trap — filled'),
    (v_item_id, 'es', 'Sifón del baño 1 — lleno');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_bath2', 20, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås bad 2 eller gjeste-wc — fylt'),
    (v_item_id, 'en', 'Bathroom 2 or guest WC trap — filled'),
    (v_item_id, 'es', 'Sifón del baño 2 o aseo — lleno');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.floor_drains', 21, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Sluk i dusj og badegulv — spylt og luktfritt'),
    (v_item_id, 'en', 'Shower and floor drains — flushed and odour-free'),
    (v_item_id, 'es', 'Desagües de ducha y suelo — enjuagados y sin olor');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.toilets', 22, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Toaletter spylt, ingen renning i sisterne'),
    (v_item_id, 'en', 'Toilets flushed, no running cistern'),
    (v_item_id, 'es', 'Inodoros descargados, cisterna sin pérdidas');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.leaks', 23, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Under vask og bak wc — ingen synlig lekkasje'),
    (v_item_id, 'en', 'Under sinks and behind WC — no visible leaks'),
    (v_item_id, 'es', 'Bajo fregaderos y tras el inodoro — sin fugas visibles');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.boiler', 24, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Varmtvannsbereder — trykk, temperatur, ingen drypp'),
    (v_item_id, 'en', 'Water heater — pressure, temperature, no dripping'),
    (v_item_id, 'es', 'Termo o caldera — presión, temperatura, sin goteo');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.stopcock', 25, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Stoppekran og vanntrykk i anlegget'),
    (v_item_id, 'en', 'Stopcock and system water pressure'),
    (v_item_id, 'es', 'Llave de paso y presión de la instalación');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ventilation', 26, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Krysslufting gjennomført, 30–45 minutter'),
    (v_item_id, 'en', 'Cross-ventilation completed, 30–45 minutes'),
    (v_item_id, 'es', 'Ventilación cruzada realizada, 30–45 minutos');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.temperature', 27, 'climate_indoor',
      false, true, 'C', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Innetemperatur'),
    (v_item_id, 'en', 'Indoor temperature'),
    (v_item_id, 'es', 'Temperatura interior');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.humidity', 28, 'climate_indoor',
      false, true, 'pct', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Relativ luftfuktighet'),
    (v_item_id, 'en', 'Relative humidity'),
    (v_item_id, 'es', 'Humedad relativa');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.mould', 29, 'climate_indoor',
      true, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Mugg- og fuktkontroll — skap, hjørner, bak møbler'),
    (v_item_id, 'en', 'Mould and damp check — cupboards, corners, behind furniture'),
    (v_item_id, 'es', 'Control de moho y humedad — armarios, esquinas, tras los muebles');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_cooling', 30, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Klimaanlegg testet — kjøling'),
    (v_item_id, 'en', 'Air conditioning tested — cooling'),
    (v_item_id, 'es', 'Aire acondicionado probado — frío');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_heating', 31, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Klimaanlegg testet — varme'),
    (v_item_id, 'en', 'Air conditioning tested — heating'),
    (v_item_id, 'es', 'Aire acondicionado probado — calor');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_filter', 32, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'AC-filter og kondensavløp'),
    (v_item_id, 'en', 'AC filter and condensate drain'),
    (v_item_id, 'es', 'Filtro del aire y desagüe de condensados');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.breakers', 33, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Sikringsskap — ingen utløste kurser'),
    (v_item_id, 'en', 'Consumer unit — no tripped breakers'),
    (v_item_id, 'es', 'Cuadro eléctrico — sin diferenciales saltados');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.electricity_meter', 34, 'power_meters',
      true, true, 'kWh', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Strømmåler avlest'),
    (v_item_id, 'en', 'Electricity meter reading'),
    (v_item_id, 'es', 'Lectura del contador de luz');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.water_meter', 35, 'power_meters',
      true, true, 'm3', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannmåler avlest'),
    (v_item_id, 'en', 'Water meter reading'),
    (v_item_id, 'es', 'Lectura del contador de agua');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.fridge', 36, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Kjøleskap og fryser i drift — temperatur'),
    (v_item_id, 'en', 'Fridge and freezer running — temperature'),
    (v_item_id, 'es', 'Frigorífico y congelador en marcha — temperatura');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.timers', 37, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Belysning og tidsur for tilstedeværelsessimulering'),
    (v_item_id, 'en', 'Lighting and timers for occupancy simulation'),
    (v_item_id, 'es', 'Iluminación y temporizadores de simulación de presencia');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.walkthrough', 38, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Samtlige rom visuelt gjennomgått'),
    (v_item_id, 'en', 'All rooms visually inspected'),
    (v_item_id, 'es', 'Todas las estancias inspeccionadas visualmente');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.pests', 39, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Skadedyr og insekter — spor og feller'),
    (v_item_id, 'en', 'Pests and insects — traces and traps'),
    (v_item_id, 'es', 'Plagas e insectos — rastros y trampas');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.appliances', 40, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Hvitevarer og elektronikk — ingen feilkoder'),
    (v_item_id, 'en', 'Appliances and electronics — no fault codes'),
    (v_item_id, 'es', 'Electrodomésticos y electrónica — sin códigos de error');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'pool.technical', 41, 'rooms_checkout',
      true, false, null, '{villa,finca}', false)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Basseng og teknisk rom — vannivå, pumpe, klarhet'),
    (v_item_id, 'en', 'Pool and plant room — water level, pump, clarity'),
    (v_item_id, 'es', 'Piscina y cuarto técnico — nivel de agua, bomba, claridad');

  insert into care.kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'checkout.secure', 42, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', true)
    returning id into v_item_id;
  insert into care.kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Utsjekk — alt låst, alarm aktivert, GPS og klokkeslett'),
    (v_item_id, 'en', 'Check-out — all locked, alarm armed, GPS and time'),
    (v_item_id, 'es', 'Salida — todo cerrado, alarma activada, GPS y hora');

  return v_template_id;
end
$fn$;

-- ==================== SEED: demo org (Zen Eco Homes) ====================
-- =====================================================================
-- Seed: demo organisation (Zen Eco Homes — first Care tenant)
-- =====================================================================
-- Provisions one org with a fixed id and its standard 42-point checklist,
-- plus a couple of plans. Run AFTER 0001_lookups.sql and 0002_checklist.sql.
-- Safe to re-run.
-- =====================================================================

insert into care.orgs (id, name, slug, default_locale, supported_locales, currency, country)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,   -- deterministic demo org id
  'Zen Eco Homes',
  'zeneco',
  'no',
  '{no,en,es,de}',
  'EUR',
  'ES'
)
on conflict (id) do nothing;

-- Standard plans (prices in cents; Principle 4).
insert into care.kh_plans (org_id, code, name, visits_per_month, price_cents, currency, included_services)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'basic',    'Basic — 1 tilsyn/mnd',    1,  9900, 'EUR', '{}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'standard', 'Standard — 2 tilsyn/mnd', 2, 17900, 'EUR', '{mail_handling}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'premium',  'Premium — 4 tilsyn/mnd',  4, 32900, 'EUR', '{mail_handling,pre_arrival}')
on conflict (org_id, code) do nothing;

-- Provision the standard checklist for the demo org (idempotent guard:
-- only if it does not already have an active 'standard' template).
do $$
begin
  if not exists (
    select 1 from care.kh_checklist_templates
    where org_id = '11111111-1111-1111-1111-111111111111'::uuid
      and code = 'standard' and is_active
  ) then
    perform care.seed_default_checklist('11111111-1111-1111-1111-111111111111'::uuid);
  end if;
end $$;

-- ==================== hardening ====================
alter function care.seed_default_checklist(uuid) set search_path = care, public;
revoke execute on function care.current_org_ids() from anon;
