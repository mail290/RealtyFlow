-- =====================================================================
-- 0011: Property documents (Fase 5 — owner portal, escritura/IBI/insurance)
-- =====================================================================

create table care.kh_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references care.orgs(id) on delete cascade,
  property_id  uuid not null references care.kh_properties(id) on delete cascade,
  doc_type     text not null check (doc_type in
                 ('escritura','insurance','ibi','community_rules','contract','energy_cert','other')),
  title        text not null,
  storage_path text not null,
  issued_on    date,
  expires_on   date,                               -- e.g. insurance renewal
  visible_to_owner boolean not null default true,  -- owner-portal visibility
  created_at   timestamptz not null default now()
);

create index idx_kh_documents_org on care.kh_documents(org_id);
create index idx_kh_documents_property on care.kh_documents(org_id, property_id);

alter table care.kh_documents enable row level security;
drop policy if exists tenant_isolation on care.kh_documents;
create policy tenant_isolation on care.kh_documents
  using (org_id in (select care.current_org_ids()))
  with check (org_id in (select care.current_org_ids()));
