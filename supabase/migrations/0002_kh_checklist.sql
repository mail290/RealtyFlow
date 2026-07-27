-- =====================================================================
-- 0002: Checklist templates, items and item translations (i18n layer 2)
-- =====================================================================
-- Principle 2: the checklist is versioned. A report always renders with
-- the checklist as it was when the inspection was performed.
-- =====================================================================

create table care.kh_checklist_templates (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references care.orgs(id) on delete cascade,
  code           text not null,                 -- e.g. 'standard'
  version        int  not null default 1,
  name           text not null,
  property_types text[] not null default '{apartment,townhouse,villa,finca}',
  min_photos     int  not null default 14,      -- enforced at completion (Phase 2)
  is_active      boolean not null default true,
  active_from    date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (org_id, code, version)
);

create index idx_kh_checklist_templates_org on care.kh_checklist_templates(org_id);
create unique index idx_kh_checklist_templates_active
  on care.kh_checklist_templates(org_id, code)
  where is_active;

create table care.kh_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references care.orgs(id) on delete cascade,
  template_id    uuid not null references care.kh_checklist_templates(id) on delete cascade,
  code           text not null,                 -- 'water.trap_kitchen' — stable, never edit
  sort_order     int  not null,
  category       text not null,
  requires_photo boolean not null default false,
  requires_value boolean not null default false,
  value_unit     text,                          -- 'm3','kWh','C','pct','count'
  applies_to     text[] not null default '{apartment,townhouse,villa,finca}',
  is_automatic   boolean not null default false,-- items 1 & 42 filled by check-in/out
  is_system      boolean not null default true,
  unique (template_id, code)
);

create index idx_kh_checklist_items_org on care.kh_checklist_items(org_id);
create index idx_kh_checklist_items_template on care.kh_checklist_items(template_id, sort_order);

create table care.kh_checklist_item_translations (
  item_id   uuid not null references care.kh_checklist_items(id) on delete cascade,
  locale    text not null references care.locales(code),
  title     text not null,
  help_text text,
  primary key (item_id, locale)
);
