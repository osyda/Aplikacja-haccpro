-- Company billing details (NIP + registered office address) for organizations,
-- and a postal code for locations — collected on the registration /
-- "Dodaj nowego klienta" forms.

alter table organizations add column if not exists nip text not null default '';
alter table organizations add column if not exists address_street text not null default '';
alter table organizations add column if not exists address_building_no text not null default '';
alter table organizations add column if not exists address_unit_no text not null default '';
alter table organizations add column if not exists address_postal_code text not null default '';
alter table organizations add column if not exists address_city text not null default '';

alter table locations add column if not exists postal_code text not null default '';

-- Self-registration now also creates the org's first location from the
-- company / location details collected on the registration form.
create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _org_id      uuid;
  _location_id uuid;
  _role        text;
begin
  if (NEW.raw_user_meta_data->>'invited_org_id') is not null then
    -- Invited user: join the existing organisation
    _org_id := (NEW.raw_user_meta_data->>'invited_org_id')::uuid;

    _location_id := null;
    if (NEW.raw_user_meta_data->>'invited_location_id') is not null
       and (NEW.raw_user_meta_data->>'invited_location_id') <> 'null' then
      _location_id := (NEW.raw_user_meta_data->>'invited_location_id')::uuid;
    end if;

    _role := coalesce(NEW.raw_user_meta_data->>'invited_role', 'staff');

    insert into profiles (id, org_id, location_id, email, full_name, role)
    values (
      NEW.id,
      _org_id,
      _location_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', ''),
      _role
    );
  else
    -- Normal signup: create a new organisation, its first location, and make the user owner
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
