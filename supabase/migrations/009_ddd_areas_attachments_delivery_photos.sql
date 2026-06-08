-- DDD: allow selecting multiple inspection areas in one entry (kitchen +
-- storage + toilets etc. are usually checked together during one visit), plus
-- attachments for the inspection protocol scan and the service invoice.
-- `area` (single, NOT NULL) is kept for backward compatibility with existing
-- rows and is backfilled into the new `areas` array; new entries write `areas`
-- only, so the NOT NULL constraint on the legacy column must be dropped.
ALTER TABLE ddd_logs ADD COLUMN IF NOT EXISTS areas text[];
ALTER TABLE ddd_logs ADD COLUMN IF NOT EXISTS doc_url text;
ALTER TABLE ddd_logs ADD COLUMN IF NOT EXISTS invoice_url text;
UPDATE ddd_logs SET areas = ARRAY[area] WHERE areas IS NULL AND area IS NOT NULL;
ALTER TABLE ddd_logs ALTER COLUMN area DROP NOT NULL;

-- Deliveries: invoices are often multiple A4 pages — let one entry carry
-- several photos/scans instead of a single `photo_url`. Existing single
-- photos are backfilled into the new array column.
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS photo_urls text[];
UPDATE delivery_logs SET photo_urls = ARRAY[photo_url] WHERE photo_urls IS NULL AND photo_url IS NOT NULL;
