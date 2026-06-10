-- Used cooking oil pickup records, plus collecting company contact info per location.

create table if not exists oil_collections (
  id             uuid primary key default uuid_generate_v4(),
  location_id    uuid not null references locations(id) on delete cascade,
  company        text not null,
  quantity       text not null,
  handed_over_by text,
  collected_at   timestamptz not null default now(),
  doc_url        text,
  doc_urls       text[],
  notes          text,
  recorded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists oil_collections_location_idx on oil_collections(location_id);

alter table oil_collections enable row level security;

grant select, insert, update, delete on oil_collections to authenticated;
grant all on oil_collections to service_role;

create policy "oil_collections_select" on oil_collections
  for select using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "oil_collections_insert" on oil_collections
  for insert with check (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "oil_collections_update" on oil_collections
  for update using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "oil_collections_delete" on oil_collections
  for delete using (location_id in (select id from locations where org_id = fn_my_org_id()));

create trigger audit_oil_collections after insert or update or delete on oil_collections for each row execute function fn_audit_trigger();

-- Contact info for the company that collects used cooking oil ("Zamów odbiór oleju")
alter table locations add column if not exists oil_company_name text;
alter table locations add column if not exists oil_company_phone text;
