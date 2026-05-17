-- ============================================================
-- HACCPro — Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Organizations
-- ============================================================
create table organizations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  plan       text not null default 'trial' check (plan in ('trial','start','pro','multi','enterprise')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Locations
-- ============================================================
create table locations (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,
  address    text not null default '',
  type       text not null default '',
  city       text not null default '',
  created_at timestamptz not null default now()
);

create index locations_org_id_idx on locations(org_id);

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'owner' check (role in ('owner','manager','staff')),
  created_at  timestamptz not null default now()
);

create index profiles_org_id_idx on profiles(org_id);
create index profiles_location_id_idx on profiles(location_id);

-- ============================================================
-- Temperature Logs
-- ============================================================
create table temperature_logs (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references locations(id) on delete cascade,
  device_name text not null,
  temperature numeric(5,1) not null,
  min_ok      numeric(5,1) not null,
  max_ok      numeric(5,1) not null,
  measured_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  notes       text
);

create index temperature_logs_location_measured_idx on temperature_logs(location_id, measured_at desc);

-- ============================================================
-- Delivery Logs
-- ============================================================
create table delivery_logs (
  id               uuid primary key default uuid_generate_v4(),
  location_id      uuid not null references locations(id) on delete cascade,
  supplier         text not null,
  product          text not null,
  quantity         text not null,
  temp_at_delivery numeric(5,1),
  expiry_date      date,
  quality_ok       boolean not null default true,
  photo_url        text,
  received_at      timestamptz not null default now(),
  recorded_by      uuid not null references auth.users(id),
  notes            text
);

create index delivery_logs_location_received_idx on delivery_logs(location_id, received_at desc);

-- ============================================================
-- Cleaning Logs
-- ============================================================
create table cleaning_logs (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references locations(id) on delete cascade,
  area        text not null,
  agent       text not null,
  concentration text,
  cleaned_at  timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  notes       text
);

create index cleaning_logs_location_cleaned_idx on cleaning_logs(location_id, cleaned_at desc);

-- ============================================================
-- Training Logs
-- ============================================================
create table training_logs (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references locations(id) on delete cascade,
  topic       text not null,
  trainer     text not null,
  trained_at  timestamptz not null default now(),
  attendees   text[] not null default '{}',
  notes       text
);

create index training_logs_location_idx on training_logs(location_id, trained_at desc);

-- ============================================================
-- Nonconformities
-- ============================================================
create table nonconformities (
  id                uuid primary key default uuid_generate_v4(),
  location_id       uuid not null references locations(id) on delete cascade,
  description       text not null,
  corrective_action text,
  status            text not null default 'open' check (status in ('open','resolved')),
  reported_by       uuid not null references auth.users(id),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index nonconformities_location_status_idx on nonconformities(location_id, status);

-- ============================================================
-- DDD Logs
-- ============================================================
create table ddd_logs (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references locations(id) on delete cascade,
  area         text not null,
  result       text not null,
  action_taken text,
  inspected_at timestamptz not null default now(),
  inspector    text not null,
  notes        text
);

create index ddd_logs_location_idx on ddd_logs(location_id, inspected_at desc);

-- ============================================================
-- Audit Log — IMMUTABLE history
-- ============================================================
create table audit_log (
  id         uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id  uuid not null,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index audit_log_table_record_idx on audit_log(table_name, record_id);
create index audit_log_changed_at_idx on audit_log(changed_at desc);

-- RLS: audit_log is insert-only, never delete
alter table audit_log enable row level security;
create policy "audit_log_insert" on audit_log for insert with check (true);
create policy "audit_log_select_own_org" on audit_log for select using (true);
-- No delete policy — prevents deletion

-- ============================================================
-- Audit Trigger Function
-- ============================================================
create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    auth.uid()
  );
  return coalesce(NEW, OLD);
end;
$$;

-- Apply audit trigger to all log tables
create trigger audit_temperature_logs after insert or update or delete on temperature_logs for each row execute function fn_audit_trigger();
create trigger audit_delivery_logs after insert or update or delete on delivery_logs for each row execute function fn_audit_trigger();
create trigger audit_cleaning_logs after insert or update or delete on cleaning_logs for each row execute function fn_audit_trigger();
create trigger audit_training_logs after insert or update or delete on training_logs for each row execute function fn_audit_trigger();
create trigger audit_nonconformities after insert or update or delete on nonconformities for each row execute function fn_audit_trigger();
create trigger audit_ddd_logs after insert or update or delete on ddd_logs for each row execute function fn_audit_trigger();

-- ============================================================
-- Auto-create org + profile on signup
-- ============================================================
create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, plan)
  values (coalesce(NEW.raw_user_meta_data->>'org_name', 'Moja firma'), 'trial')
  returning id into new_org_id;

  insert into profiles (id, org_id, email, full_name, role)
  values (
    NEW.id,
    new_org_id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    'owner'
  );

  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table organizations enable row level security;
alter table locations enable row level security;
alter table profiles enable row level security;
alter table temperature_logs enable row level security;
alter table delivery_logs enable row level security;
alter table cleaning_logs enable row level security;
alter table training_logs enable row level security;
alter table nonconformities enable row level security;
alter table ddd_logs enable row level security;

-- Helper: get current user's org_id
create or replace function fn_my_org_id()
returns uuid
language sql
stable
as $$
  select org_id from profiles where id = auth.uid() limit 1;
$$;

-- Helper: get current user's location_id
create or replace function fn_my_location_id()
returns uuid
language sql
stable
as $$
  select location_id from profiles where id = auth.uid() limit 1;
$$;

-- Organizations: own org only
create policy "org_select" on organizations for select using (id = fn_my_org_id());
create policy "org_update" on organizations for update using (id = fn_my_org_id());

-- Locations: all locations in own org
create policy "locations_select" on locations for select using (org_id = fn_my_org_id());
create policy "locations_insert" on locations for insert with check (org_id = fn_my_org_id());
create policy "locations_update" on locations for update using (org_id = fn_my_org_id());

-- Profiles: all in own org
create policy "profiles_select" on profiles for select using (org_id = fn_my_org_id());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- Log tables: scoped to own location(s) within org
create policy "temp_logs_select" on temperature_logs for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "temp_logs_insert" on temperature_logs for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

create policy "delivery_logs_select" on delivery_logs for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "delivery_logs_insert" on delivery_logs for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

create policy "cleaning_logs_select" on cleaning_logs for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "cleaning_logs_insert" on cleaning_logs for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

create policy "training_logs_select" on training_logs for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "training_logs_insert" on training_logs for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

create policy "nonconformities_select" on nonconformities for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "nonconformities_insert" on nonconformities for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "nonconformities_update" on nonconformities for update using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

create policy "ddd_logs_select" on ddd_logs for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "ddd_logs_insert" on ddd_logs for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

-- ============================================================
-- Storage bucket for delivery photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('delivery-photos', 'delivery-photos', true)
on conflict do nothing;

create policy "delivery_photos_upload" on storage.objects
  for insert with check (bucket_id = 'delivery-photos' and auth.role() = 'authenticated');
create policy "delivery_photos_read" on storage.objects
  for select using (bucket_id = 'delivery-photos');
