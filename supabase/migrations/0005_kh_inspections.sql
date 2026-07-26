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
