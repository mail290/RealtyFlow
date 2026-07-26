-- =====================================================================
-- Seed: demo organisation (Zen Eco Homes — first Care tenant)
-- =====================================================================
-- Provisions one org with a fixed id and its standard 42-point checklist,
-- plus a couple of plans. Run AFTER 0001_lookups.sql and 0002_checklist.sql.
-- Safe to re-run.
-- =====================================================================

insert into orgs (id, name, slug, default_locale, supported_locales, currency, country)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,   -- deterministic demo org id
  'Zen Eco Homes',
  'zeneco',
  'no',
  '{no,en,es,de}',
  'EUR',
  'ES'
)
on conflict (id) do nothing;

-- Standard plans (prices in cents; Principle 4).
insert into kh_plans (org_id, code, name, visits_per_month, price_cents, currency, included_services)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'basic',    'Basic — 1 tilsyn/mnd',    1,  9900, 'EUR', '{}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'standard', 'Standard — 2 tilsyn/mnd', 2, 17900, 'EUR', '{mail_handling}'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'premium',  'Premium — 4 tilsyn/mnd',  4, 32900, 'EUR', '{mail_handling,pre_arrival}')
on conflict (org_id, code) do nothing;

-- Provision the standard checklist for the demo org (idempotent guard:
-- only if it does not already have an active 'standard' template).
do $$
begin
  if not exists (
    select 1 from kh_checklist_templates
    where org_id = '11111111-1111-1111-1111-111111111111'::uuid
      and code = 'standard' and is_active
  ) then
    perform kh_seed_default_checklist('11111111-1111-1111-1111-111111111111'::uuid);
  end if;
end $$;
