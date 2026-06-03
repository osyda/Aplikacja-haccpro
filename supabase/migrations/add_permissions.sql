-- Uruchom to w Supabase: SQL Editor → New query → Run

-- 1. Dodaj kolumnę permissions do tabeli profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;

-- 2. Zezwól właścicielom/kierownikom na aktualizację profili w tej samej organizacji
--    (potrzebne żeby właściciel mógł zmieniać uprawnienia pracownikom)
DROP POLICY IF EXISTS "owners_can_update_org_profiles" ON profiles;
CREATE POLICY "owners_can_update_org_profiles" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.org_id = profiles.org_id
        AND p.role IN ('owner', 'manager')
    )
  );
