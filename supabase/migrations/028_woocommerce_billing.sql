-- ============================================================
-- WooCommerce billing integration foundation.
--
-- 1. organizations.woo_customer_id / subscription_status — populated by
--    /api/webhooks/woocommerce when a plan is purchased, renewed or
--    cancelled. subscription_status is informational only for now; no
--    automatic downgrade/enforcement happens here yet.
--
-- 2. pending_plan_grants — when a WooCommerce purchase can't be matched to an
--    existing organisation (brand-new customer, no app account yet), it is
--    recorded here by e-mail. fn_handle_new_user consumes a matching grant at
--    registration time and sets the new org's plan immediately instead of
--    defaulting to `trial`.
-- ============================================================

alter table organizations
  add column if not exists woo_customer_id text,
  add column if not exists subscription_status text;

create table if not exists pending_plan_grants (
  id              uuid primary key default uuid_generate_v4(),
  email           text not null,
  plan            text not null check (plan in ('start','pro','multi','enterprise')),
  woo_order_id    text,
  woo_customer_id text,
  created_at      timestamptz not null default now(),
  used_at         timestamptz
);

alter table pending_plan_grants enable row level security;
-- No policies: readable/writable only via the service-role key (webhook
-- handler) and the SECURITY DEFINER trigger below.

create index if not exists pending_plan_grants_email_idx
  on pending_plan_grants (lower(email)) where used_at is null;

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
  _grant       pending_plan_grants%rowtype;
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

    insert into profiles (id, org_id, location_id, email, full_name, phone, role)
    values (
      NEW.id,
      _invite.org_id,
      _invite.location_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      coalesce(NEW.raw_user_meta_data->>'phone', ''),
      _invite.role
    );
  else
    -- Normal signup: create a new organisation on a 14-day trial, its first
    -- location, and make the user owner of it.
    insert into organizations (
      name, plan, trial_ends_at,
      nip, address_street, address_building_no, address_unit_no, address_postal_code, address_city
    )
    values (
      coalesce(NEW.raw_user_meta_data->>'org_name', 'Moja firma'), 'trial', now() + interval '14 days',
      coalesce(NEW.raw_user_meta_data->>'nip', ''),
      coalesce(NEW.raw_user_meta_data->>'address_street', ''),
      coalesce(NEW.raw_user_meta_data->>'address_building_no', ''),
      coalesce(NEW.raw_user_meta_data->>'address_unit_no', ''),
      coalesce(NEW.raw_user_meta_data->>'address_postal_code', ''),
      coalesce(NEW.raw_user_meta_data->>'address_city', '')
    )
    returning id into _org_id;

    -- If this e-mail already paid for a plan on haccpro.pl before
    -- registering (no app account existed yet to link the purchase to),
    -- apply that plan now instead of leaving the org on `trial`.
    select * into _grant
    from pending_plan_grants
    where lower(email) = lower(NEW.email) and used_at is null
    order by created_at desc
    limit 1;

    if _grant.id is not null then
      update organizations
      set plan = _grant.plan,
          is_active = true,
          subscription_status = 'active',
          woo_customer_id = _grant.woo_customer_id
      where id = _org_id;

      update pending_plan_grants set used_at = now() where id = _grant.id;
    end if;

    insert into locations (org_id, name, address, city, postal_code)
    values (
      _org_id,
      coalesce(nullif(NEW.raw_user_meta_data->>'location_name', ''), coalesce(NEW.raw_user_meta_data->>'org_name', 'Mój lokal')),
      coalesce(NEW.raw_user_meta_data->>'location_address', ''),
      coalesce(NEW.raw_user_meta_data->>'location_city', ''),
      coalesce(NEW.raw_user_meta_data->>'location_postal_code', '')
    )
    returning id into _location_id;

    insert into profiles (id, org_id, location_id, email, full_name, phone, role)
    values (
      NEW.id,
      _org_id,
      _location_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      coalesce(NEW.raw_user_meta_data->>'phone', ''),
      'owner'
    );
  end if;

  return NEW;
end;
$$;
