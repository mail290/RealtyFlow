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
