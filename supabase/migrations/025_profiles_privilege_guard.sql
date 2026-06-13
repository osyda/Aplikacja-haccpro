-- ============================================================
-- Prevent profile self-privilege-escalation and cross-org re-parenting.
--
-- The existing UPDATE policies on `profiles` (profiles_update_own,
-- profiles_update_owner, owners_can_update_org_profiles) have no
-- WITH CHECK clause, so any authenticated user can PATCH their own
-- profiles row directly via the Supabase client/REST API and set
-- role = 'owner', set arbitrary `permissions`, or move themselves to a
-- different org_id — granting themselves full control of an
-- organisation.
--
-- This BEFORE UPDATE trigger acts as a backstop regardless of which RLS
-- policy lets an UPDATE through:
--   - org_id can never change via UPDATE.
--   - a user can never change their own role or permissions.
--   - role / permissions / location_id may be changed for OTHER users
--     in the same org only by an owner/manager, and only an existing
--     owner may grant or revoke the 'owner' role — matching the checks
--     already performed in app/api/set-permissions/route.ts.
--   - location_id (self or other) must always point at a location in
--     the same org.
--   - service-role / definer-context calls (auth.uid() is null) are
--     trusted, since those are gated by application-level checks.
-- ============================================================

create or replace function fn_profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller_role text;
begin
  if NEW.org_id is distinct from OLD.org_id then
    raise exception 'Zmiana organizacji profilu jest niedozwolona';
  end if;

  if auth.uid() = OLD.id then
    if NEW.role is distinct from OLD.role or NEW.permissions is distinct from OLD.permissions then
      raise exception 'Nie można zmienić własnej roli lub uprawnień';
    end if;

    if NEW.location_id is distinct from OLD.location_id
       and NEW.location_id is not null
       and not exists (select 1 from locations where id = NEW.location_id and org_id = OLD.org_id) then
      raise exception 'Nieprawidłowa lokalizacja';
    end if;

    return NEW;
  end if;

  if NEW.role is distinct from OLD.role
     or NEW.permissions is distinct from OLD.permissions
     or NEW.location_id is distinct from OLD.location_id then

    if auth.uid() is null then
      -- service-role / SECURITY DEFINER RPC context: trust application-level checks
      return NEW;
    end if;

    select role into _caller_role from profiles where id = auth.uid() and org_id = OLD.org_id;

    if _caller_role is null or _caller_role not in ('owner','manager') then
      raise exception 'Brak uprawnień do edycji tego profilu';
    end if;

    if (NEW.role = 'owner' or OLD.role = 'owner')
       and NEW.role is distinct from OLD.role
       and _caller_role <> 'owner' then
      raise exception 'Tylko właściciel może zarządzać rolą "owner"';
    end if;

    if NEW.location_id is distinct from OLD.location_id
       and NEW.location_id is not null
       and not exists (select 1 from locations where id = NEW.location_id and org_id = OLD.org_id) then
      raise exception 'Nieprawidłowa lokalizacja';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_profiles_guard_privileged_update on profiles;
create trigger trg_profiles_guard_privileged_update
  before update on profiles
  for each row execute function fn_profiles_guard_privileged_update();
