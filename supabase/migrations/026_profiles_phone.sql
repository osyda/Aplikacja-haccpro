-- ============================================================
-- Add a contact phone number for the org owner, collected on the
-- self-registration form and the superadmin "Add client" form, and
-- stored on profiles via fn_handle_new_user() (same mechanism as
-- full_name/org_name/nip/address_* already use).
-- ============================================================

alter table profiles add column if not exists phone text not null default '';

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
