-- =====================================================================
-- 0003: Properties under management, plans and contracts
-- =====================================================================
-- A kh_property is not a listing. A listing is sold; a kh_property is
-- looked after. They may point at each other (owner may sell later —
-- a valuable pipeline) but they are not the same row.
-- Principle 4: money is stored as integer minor units (bigint cents),
-- every money table carries currency char(3).
-- =====================================================================

create table kh_properties (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  brand_id      uuid references brands(id),
  owner_id      uuid not null references contacts(id),
  listing_id    uuid references listings(id),  -- if also for sale
  reference     text not null,                 -- KH-0001, unique per org
  property_type text not null check (property_type in ('apartment','townhouse','villa','finca')),
  name          text,                          -- friendly name for reports
  address_line  text not null,
  municipality  text not null,
  postcode      text,
  country       char(2) not null default 'ES',
  lat           numeric(9,6),
  lng           numeric(9,6),
  has_pool      boolean not null default false,
  has_garden    boolean not null default false,
  access_notes  jsonb,                         -- gate code, alarm, parking
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  unique (org_id, reference)
);

create index idx_kh_properties_org on kh_properties(org_id);
create index idx_kh_properties_owner on kh_properties(org_id, owner_id);

-- Plans are per organisation, not global — each SaaS tenant sets its own.
create table kh_plans (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
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

create index idx_kh_plans_org on kh_plans(org_id);

create table kh_contracts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  property_id   uuid not null references kh_properties(id) on delete cascade,
  plan_id       uuid not null references kh_plans(id),
  plan_snapshot jsonb not null,                -- Principle 2 — frozen plan terms
  starts_on     date not null,
  ends_on       date,
  billing_day   int not null default 1,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

create index idx_kh_contracts_org on kh_contracts(org_id);
create index idx_kh_contracts_property on kh_contracts(org_id, property_id);
