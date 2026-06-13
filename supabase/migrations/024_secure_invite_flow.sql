-- ============================================================
-- Close cross-tenant org-takeover hole in the signup trigger.
--
-- fn_handle_new_user() previously trusted
-- raw_user_meta_data->>'invited_org_id' / 'invited_role' /
-- 'invited_location_id' unconditionally. raw_user_meta_data is set via
-- the *public* supabase.auth.signUp() API (options.data), which any
-- caller controls — so anyone with the anon key could sign up with
-- invited_role: 'owner' and an arbitrary invited_org_id and be granted
-- full owner access to that organisation via RLS (fn_my_org_id() reads
-- profiles.org_id).
--
-- Fix: invite-staff and admin/orgs now create a row in this `invites`
-- table (server-side, after their own authorization checks) and pass
-- only an opaque, random `invite_token` in raw_user_meta_data.
-- fn_handle_new_user() only joins an existing org if it finds a
-- matching, unexpired, unused invite for that token + email — any
-- 'invited_org_id'/'invited_role'/'invited_location_id' metadata is now
-- ignored entirely.
-- ============================================================

-- Idempotent: a previous partial run of this migration may have already
-- created the table (this feature is brand new, so it can hold no real
-- invite data yet — safe to drop and recreate along with its indexes/policies).
drop table if exists invites cascade;

create table invites (
  id          uuid primary key default uuid_generate_v4(),
  token       uuid not null default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  role        text not null check (role in ('owner','manager','staff')),
  email       text not null,
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  used_at     timestamptz
);

create unique index invites_token_idx on invites(token);
create index invites_org_id_idx on invites(org_id);
create index invites_email_idx on invites(lower(email));

alter table invites enable row level security;

-- Owners/managers can see pending invites for their own org.
create policy "invites_select_org" on invites for select using (
  org_id = fn_my_org_id()
);

-- Owners/managers can create staff/manager invites for their own org and
-- locations only. Owner-role invites (used when the superadmin creates a
-- new organisation) are issued via the service-role client, which bypasses
-- RLS entirely.
create policy "invites_insert_org" on invites for insert with check (
  org_id = fn_my_org_id()
  and role in ('manager','staff')
  and (location_id is null or location_id in (select id from locations where org_id = fn_my_org_id()))
  and (select role from profiles where id = auth.uid() limit 1) in ('owner','manager')
);

-- Owners/managers can cancel/clean up pending invites for their own org
-- (e.g. when the invite email fails to send, or to revoke an invite).
create policy "invites_delete_org" on invites for delete using (
  org_id = fn_my_org_id()
  and (select role from profiles where id = auth.uid() limit 1) in ('owner','manager')
);

-- ============================================================
-- fn_handle_new_user(): validate invites via token instead of trusting
-- client-supplied invited_org_id / invited_role / invited_location_id.
-- ============================================================
create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _org_id      uuid;
  _location_id uuid;
  _invite      invites%rowtype;
begin
  if (NEW.raw_user_meta_data->>'invite_token') is not null
     and (NEW.raw_user_meta_data->>'invite_token') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into _invite
    from invites
    where token = (NEW.raw_user_meta_data->>'invite_token')::uuid
      and lower(email) = lower(NEW.email)
      and used_at is null
      and expires_at > now()
    limit 1;
  end if;

  if _invite.id is not null then
    -- Valid invite: join the inviting organisation with the role/location it specifies.
    update invites set used_at = now() where id = _invite.id;

    insert into profiles (id, org_id, location_id, email, full_name, role)
    values (
      NEW.id,
      _invite.org_id,
      _invite.location_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      _invite.role
    );
  else
    -- Normal signup (or invalid/expired/forged invite metadata): create a
    -- new organisation, its first location, and make the user owner of it.
    insert into organizations (name, plan, nip, address_street, address_building_no, address_unit_no, address_postal_code, address_city)
    values (
      coalesce(NEW.raw_user_meta_data->>'org_name', 'Moja firma'), 'trial',
      coalesce(NEW.raw_user_meta_data->>'nip', ''),
      coalesce(NEW.raw_user_meta_data->>'address_street', ''),
      coalesce(NEW.raw_user_meta_data->>'address_building_no', ''),
      coalesce(NEW.raw_user_meta_data->>'address_unit_no', ''),
      coalesce(NEW.raw_user_meta_data->>'address_postal_code', ''),
      coalesce(NEW.raw_user_meta_data->>'address_city', '')
    )
    returning id into _org_id;

    insert into locations (org_id, name, address, city, postal_code)
    values (
      _org_id,
      coalesce(nullif(NEW.raw_user_meta_data->>'location_name', ''), coalesce(NEW.raw_user_meta_data->>'org_name', 'Mój lokal')),
      coalesce(NEW.raw_user_meta_data->>'location_address', ''),
      coalesce(NEW.raw_user_meta_data->>'location_city', ''),
      coalesce(NEW.raw_user_meta_data->>'location_postal_code', '')
    )
    returning id into _location_id;

    insert into profiles (id, org_id, location_id, email, full_name, role)
    values (
      NEW.id,
      _org_id,
      _location_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      'owner'
    );
  end if;

  return NEW;
end;
$$;
