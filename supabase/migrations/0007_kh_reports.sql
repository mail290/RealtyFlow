-- =====================================================================
-- 0007: Reports and report deliveries (schema now, used in Phase 3)
-- =====================================================================
-- A report is rendered from a frozen data_snapshot, never live data.
-- content_hash is the sha256 of the finished PDF: same snapshot ⇒ same
-- hash, and nobody can claim the document was altered after sending.
-- =====================================================================

create table kh_reports (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  inspection_id   uuid not null references kh_inspections(id) on delete cascade,
  property_id     uuid not null references kh_properties(id),
  reference       text not null,                 -- KH-R-26-0001
  locale          text not null references locales(code),
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

create index idx_kh_reports_org on kh_reports(org_id);
create index idx_kh_reports_inspection on kh_reports(inspection_id);

create table kh_report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  report_id   uuid not null references kh_reports(id) on delete cascade,
  channel     text not null check (channel in ('email','whatsapp','manual')),
  recipient   text not null,
  token_id    uuid references kh_access_tokens(id),
  sent_at     timestamptz not null default now(),
  provider_id text,                              -- Resend message-id
  status      text not null default 'sent'
              check (status in ('sent','delivered','bounced','failed'))
);

create index idx_kh_report_deliveries_org on kh_report_deliveries(org_id);
create index idx_kh_report_deliveries_report on kh_report_deliveries(report_id);

-- Per-org, per-year sequence for customer-facing report numbers.
-- (KH-R-{yy}-{seq}). Never use random ids in customer communication.
create table kh_report_counters (
  org_id     uuid not null references orgs(id) on delete cascade,
  year       int  not null,
  last_value int  not null default 0,
  primary key (org_id, year)
);
