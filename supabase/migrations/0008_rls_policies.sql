-- =====================================================================
-- 0008: Row Level Security — tenant isolation on every care table
-- =====================================================================
-- Principle 1: RLS is enforced in the database, not the application.
-- care.orgs / care.org_members already got their policies in 0001.
-- =====================================================================

do $$
declare
  t text;
  org_scoped text[] := array[
    'kh_checklist_templates',
    'kh_checklist_items',
    'kh_properties',
    'kh_plans',
    'kh_contracts',
    'kh_vendors',
    'kh_vendor_trades',
    'kh_vendor_agreements',
    'kh_inspections',
    'kh_inspection_items',
    'kh_photos',
    'kh_meter_readings',
    'kh_issues',
    'kh_access_tokens',
    'kh_work_orders',
    'kh_reports',
    'kh_report_deliveries',
    'kh_report_counters'
  ];
begin
  foreach t in array org_scoped loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on care.%I', t);
    execute format(
      'create policy tenant_isolation on care.%I '
      'using (org_id in (select care.current_org_ids())) '
      'with check (org_id in (select care.current_org_ids()))', t);
  end loop;
end $$;

-- kh_checklist_item_translations has no org_id; it inherits isolation from
-- its parent item.
alter table care.kh_checklist_item_translations enable row level security;
drop policy if exists tenant_isolation on care.kh_checklist_item_translations;
create policy tenant_isolation on care.kh_checklist_item_translations
  using (
    exists (
      select 1 from care.kh_checklist_items i
      where i.id = kh_checklist_item_translations.item_id
        and i.org_id in (select care.current_org_ids())
    )
  )
  with check (
    exists (
      select 1 from care.kh_checklist_items i
      where i.id = kh_checklist_item_translations.item_id
        and i.org_id in (select care.current_org_ids())
    )
  );

-- Global system content (i18n layer 2) is readable by any authenticated
-- user; writes are reserved for the service role (which bypasses RLS).
do $$
declare
  t text;
  global_lookup text[] := array['locales','trades','trade_translations'];
begin
  foreach t in array global_lookup loop
    execute format('alter table care.%I enable row level security', t);
    execute format('drop policy if exists read_all_authenticated on care.%I', t);
    execute format(
      'create policy read_all_authenticated on care.%I '
      'for select to authenticated using (true)', t);
  end loop;
end $$;

-- NOTE: public.contacts / brands / listings are shared CRM objects governed
-- by the CRM's own RLS. They are intentionally NOT given Care policies here.
