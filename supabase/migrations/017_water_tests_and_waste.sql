-- Water quality test records (e.g. annual potable water lab tests).
create table if not exists water_tests (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references locations(id) on delete cascade,
  company      text not null,
  tested_at    date not null default current_date,
  result       text,
  notes        text,
  doc_url      text,
  doc_urls     text[],
  recorded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists water_tests_location_idx on water_tests(location_id);

alter table water_tests enable row level security;

grant select, insert, update, delete on water_tests to authenticated;
grant all on water_tests to service_role;

create policy "water_tests_select" on water_tests
  for select using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "water_tests_insert" on water_tests
  for insert with check (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "water_tests_update" on water_tests
  for update using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "water_tests_delete" on water_tests
  for delete using (location_id in (select id from locations where org_id = fn_my_org_id()));

create trigger audit_water_tests after insert or update or delete on water_tests for each row execute function fn_audit_trigger();


-- Waste collection contracts (who picks up waste, since when).
create table if not exists waste_contracts (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references locations(id) on delete cascade,
  company      text not null,
  signed_at    date,
  notes        text,
  doc_url      text,
  doc_urls     text[],
  recorded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists waste_contracts_location_idx on waste_contracts(location_id);

alter table waste_contracts enable row level security;

grant select, insert, update, delete on waste_contracts to authenticated;
grant all on waste_contracts to service_role;

create policy "waste_contracts_select" on waste_contracts
  for select using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_contracts_insert" on waste_contracts
  for insert with check (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_contracts_update" on waste_contracts
  for update using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_contracts_delete" on waste_contracts
  for delete using (location_id in (select id from locations where org_id = fn_my_org_id()));

create trigger audit_waste_contracts after insert or update or delete on waste_contracts for each row execute function fn_audit_trigger();


-- Recurring waste pickup schedule, derived from a scanned "harmonogram" (or entered manually).
-- 'weekly'/'biweekly' use day_of_week (0=Mon..6=Sun); 'monthly' uses day_of_month (1-31);
-- 'once' uses specific_date for a single one-off pickup. anchor_date is used for 'biweekly'
-- to determine which weeks apply (relative to a known pickup date).
create table if not exists waste_schedule_items (
  id            uuid primary key default uuid_generate_v4(),
  location_id   uuid not null references locations(id) on delete cascade,
  waste_type    text not null,
  frequency     text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'once')),
  day_of_week   int check (day_of_week between 0 and 6),
  day_of_month  int check (day_of_month between 1 and 31),
  specific_date date,
  anchor_date   date,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists waste_schedule_items_location_idx on waste_schedule_items(location_id);

alter table waste_schedule_items enable row level security;

grant select, insert, update, delete on waste_schedule_items to authenticated;
grant all on waste_schedule_items to service_role;

create policy "waste_schedule_items_select" on waste_schedule_items
  for select using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_schedule_items_insert" on waste_schedule_items
  for insert with check (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_schedule_items_update" on waste_schedule_items
  for update using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "waste_schedule_items_delete" on waste_schedule_items
  for delete using (location_id in (select id from locations where org_id = fn_my_org_id()));

create trigger audit_waste_schedule_items after insert or update or delete on waste_schedule_items for each row execute function fn_audit_trigger();
