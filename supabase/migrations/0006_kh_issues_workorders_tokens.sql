-- =====================================================================
-- 0006: Issues, work orders and passwordless access tokens
-- =====================================================================
-- Issues live across inspections ("bedroom 2 blind is slow" must not
-- vanish when the report is sent). Work orders carry a frozen
-- agreement_snapshot and pre-computed money (Principle 2 & 4).
-- =====================================================================

create table kh_issues (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  property_id   uuid not null references kh_properties(id) on delete cascade,
  inspection_id uuid references kh_inspections(id),
  item_code     text,
  severity      text not null check (severity in ('info','low','medium','high','urgent')),
  title         jsonb not null,                  -- i18n layer 3 (author's language)
  description   jsonb,
  trade_code    text references trades(code),
  status        text not null default 'open'
                check (status in ('open','in_progress','closed')),
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz
);

create index idx_kh_issues_org on kh_issues(org_id);
create index idx_kh_issues_property on kh_issues(org_id, property_id, status);

-- Passwordless access — one mechanism for both owner and vendor.
-- Declared before work orders / reports that reference it.
create table kh_access_tokens (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  token_hash  text not null unique,              -- sha256, never store raw token
  scope       text not null,                     -- 'report:view','workorder:respond'
  subject_id  uuid not null,
  locale      text not null references locales(code),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_kh_access_tokens_org on kh_access_tokens(org_id);

create table kh_work_orders (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  property_id        uuid not null references kh_properties(id),
  issue_id           uuid references kh_issues(id),
  vendor_id          uuid references kh_vendors(id),
  agreement_id       uuid references kh_vendor_agreements(id),
  agreement_snapshot jsonb,                       -- Principle 2
  reference          text not null,               -- WO-26-0001, unique per org
  status             text not null default 'draft',
  -- draft→sent→quoted→pending_owner_approval→approved→scheduled
  --      →in_progress→completed→invoiced→closed (state machine in TS)
  vendor_locale      text not null,
  description        jsonb not null,              -- i18n layer 3
  budget_cap_cents   bigint,
  owner_approved_at  timestamptz,
  owner_approved_by  uuid references contacts(id),
  scheduled_for      date,
  completed_at       timestamptz,
  -- economics: every amount stored at calculation time, never recomputed on read
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

create index idx_kh_work_orders_org on kh_work_orders(org_id);
create index idx_kh_work_orders_property on kh_work_orders(org_id, property_id);
