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
