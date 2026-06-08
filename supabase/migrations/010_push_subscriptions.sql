-- Web Push subscriptions: lets users opt in to real-time phone/browser
-- notifications (PWA) for temperature alarms and missing daily checks.
create table if not exists push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_idx on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on push_subscriptions for select using (profile_id = auth.uid());
create policy "push_subscriptions_insert_own" on push_subscriptions for insert with check (profile_id = auth.uid());
create policy "push_subscriptions_delete_own" on push_subscriptions for delete using (profile_id = auth.uid());
