-- Update fn_handle_new_user to support invited users (join existing org instead of creating new)
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id      uuid;
  _location_id uuid;
  _role        text;
BEGIN
  IF (NEW.raw_user_meta_data->>'invited_org_id') IS NOT NULL THEN
    -- Invited user: join the existing organisation
    _org_id := (NEW.raw_user_meta_data->>'invited_org_id')::uuid;

    _location_id := NULL;
    IF (NEW.raw_user_meta_data->>'invited_location_id') IS NOT NULL
       AND (NEW.raw_user_meta_data->>'invited_location_id') <> 'null' THEN
      _location_id := (NEW.raw_user_meta_data->>'invited_location_id')::uuid;
    END IF;

    _role := COALESCE(NEW.raw_user_meta_data->>'invited_role', 'staff');

    INSERT INTO profiles (id, org_id, location_id, email, full_name, role)
    VALUES (
      NEW.id,
      _org_id,
      _location_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      _role
    );
  ELSE
    -- Normal signup: create a new organisation and make the user owner
    INSERT INTO organizations (name, plan)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', 'Moja firma'), 'trial')
    RETURNING id INTO _org_id;

    INSERT INTO profiles (id, org_id, email, full_name, role)
    VALUES (
      NEW.id,
      _org_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'owner'
    );
  END IF;

  RETURN NEW;
END;
$$;
