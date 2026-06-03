-- Allow owners/managers to update profiles in their own org
-- Needed because profiles_update_own only allows users to update their own row
CREATE POLICY "profiles_update_owner" ON profiles
FOR UPDATE USING (
  org_id = fn_my_org_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('owner', 'manager')
);
