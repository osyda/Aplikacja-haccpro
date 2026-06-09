-- Scheduled cleaning task templates with frequency-based scheduling.
-- Linked to cleaning_logs via cleaning_task_id to track completions.

create table if not exists cleaning_tasks (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references locations(id) on delete cascade,
  name         text not null,
  area         text not null,
  agent        text,
  frequency    text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week  int  check (day_of_week  between 0 and 6),  -- 0=Mon..6=Sun, for weekly
  day_of_month int  check (day_of_month between 1 and 28), -- for monthly
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id)
);

create index if not exists cleaning_tasks_location_idx on cleaning_tasks(location_id);

alter table cleaning_tasks enable row level security;

grant select, insert, update, delete on cleaning_tasks to authenticated;
grant all on cleaning_tasks to service_role;

create policy "cleaning_tasks_select" on cleaning_tasks
  for select using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "cleaning_tasks_insert" on cleaning_tasks
  for insert with check (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "cleaning_tasks_update" on cleaning_tasks
  for update using (location_id in (select id from locations where org_id = fn_my_org_id()));

create policy "cleaning_tasks_delete" on cleaning_tasks
  for delete using (location_id in (select id from locations where org_id = fn_my_org_id()));

-- Link cleaning_logs entries to the task that triggered them (nullable for ad-hoc entries)
alter table cleaning_logs add column if not exists cleaning_task_id uuid references cleaning_tasks(id) on delete set null;
