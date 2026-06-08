-- Lets devices be grouped by physical area (e.g. Kuchnia, Sala, Magazyn) so
-- locations with many fridges/freezers can scan their checklist by zone
-- instead of one long flat list. Optional — null means "no zone assigned".
ALTER TABLE location_devices ADD COLUMN IF NOT EXISTS zone text;
