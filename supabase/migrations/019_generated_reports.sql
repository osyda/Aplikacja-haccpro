-- ============================================================
-- Generated Reports — persist PDF report history
-- ============================================================
-- The "Raporty" page generates PDF reports on demand but never stored
-- them, so "Poprzednie raporty" always showed "coming soon". This adds
-- a table to record each generated report and a storage bucket to keep
-- the PDF file, so users can re-download past reports.

create table generated_reports (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references locations(id) on delete cascade,
  modules      text[] not null,
  period_month int not null check (period_month between 1 and 12),
  period_year  int not null,
  file_path    text not null,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now()
);

create index generated_reports_location_idx on generated_reports(location_id, generated_at desc);

alter table generated_reports enable row level security;

create policy "generated_reports_select" on generated_reports for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
create policy "generated_reports_insert" on generated_reports for insert with check (
  location_id in (select id from locations where org_id = fn_my_org_id())
);

insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict do nothing;

create policy "reports_upload" on storage.objects
  for insert with check (bucket_id = 'reports' and auth.role() = 'authenticated');
create policy "reports_read" on storage.objects
  for select using (bucket_id = 'reports');
