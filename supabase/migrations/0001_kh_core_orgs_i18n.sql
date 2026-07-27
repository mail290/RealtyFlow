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
