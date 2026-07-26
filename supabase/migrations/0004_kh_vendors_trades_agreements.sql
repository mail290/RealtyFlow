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
