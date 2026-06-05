-- Admin management columns for organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_ends_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes    TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Initialize trial_ends_at for existing trial organizations (14 days from registration)
UPDATE organizations
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE plan = 'trial' AND trial_ends_at IS NULL;

CREATE INDEX IF NOT EXISTS organizations_active_idx ON organizations(is_active);
CREATE INDEX IF NOT EXISTS organizations_plan_idx   ON organizations(plan);
