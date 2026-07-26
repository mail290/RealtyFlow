-- =====================================================================
-- Care / Keyholding module — Phase 1 foundation
-- 0001: Core tenancy, locales (i18n layer 2), shared CRM stubs
-- =====================================================================
-- Principle 1: everything is multi-tenant from the first migration.
-- Principle 3: language is a property of the recipient, not the system.
--
-- This migration is idempotent-friendly and runs on an EMPTY database.
-- The `contacts`, `brands` and `listings` tables are CRM objects that
-- may already exist in a RealtyFlow deployment; we create minimal stubs
-- with `if not exists` so the FKs below resolve without clobbering an
-- existing CRM schema.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- i18n layer 2 — system content locales (delivered translated by us)
-- ---------------------------------------------------------------------
create table if not exists locales (
  code    text primary key,
  name_en text not null,
  rtl     boolean not null default false
);

-- ---------------------------------------------------------------------
-- Shared CRM objects (stubs — reused across CRM and Care via FK)
-- ---------------------------------------------------------------------
create table if not exists brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  full_name  text,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  created_at timestamptz not null default now()
);

-- `contacts.locale` decides the report language for the owner (Principle 3).
alter table contacts
  add column if not exists locale text references locales(code);

-- ---------------------------------------------------------------------
-- Organisations & membership
-- ---------------------------------------------------------------------
create table if not exists orgs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  default_locale    text not null references locales(code),
  supported_locales text[] not null default '{en}',
  currency          char(3) not null default 'EUR',
  timezone          text not null default 'Europe/Madrid',
  country           char(2) not null default 'ES',
  -- Anomaly thresholds live on the org, not in code (Phase 2 leak detection).
  water_leak_lpd    numeric(12,3) not null default 20,   -- litres/day, empty home
  power_leak_kwhpd  numeric(12,3) not null default 3,    -- kWh/day, empty home
  created_at        timestamptz not null default now()
);

create table if not exists org_members (
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','admin','inspector','viewer')),
  locale     text references locales(code),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_org_members_user on org_members(user_id);

-- ---------------------------------------------------------------------
-- RLS helper. security definer so evaluating the policy on org_members
-- does not recurse into org_members' own RLS policy.
-- ---------------------------------------------------------------------
create or replace function current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from org_members where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- RLS on the tenancy tables themselves.
-- orgs: a member may see orgs they belong to.
-- org_members: a member may see membership rows of their own orgs.
-- ---------------------------------------------------------------------
alter table orgs enable row level security;
drop policy if exists tenant_isolation on orgs;
create policy tenant_isolation on orgs
  using (id in (select current_org_ids()))
  with check (id in (select current_org_ids()));

alter table org_members enable row level security;
drop policy if exists tenant_isolation on org_members;
create policy tenant_isolation on org_members
  using (org_id in (select current_org_ids()))
  with check (org_id in (select current_org_ids()));
