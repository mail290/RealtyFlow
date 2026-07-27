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
