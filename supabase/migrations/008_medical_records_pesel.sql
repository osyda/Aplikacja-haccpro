-- Gives medical_records a dedicated PESEL column instead of encoding it as
-- the first line of `notes` ("PESEL: XXXXXXXXXXX\nrest of notes"). Existing
-- rows are backfilled by extracting the PESEL out of `notes` and stripping
-- the encoded prefix from the stored text (leaving NULL when nothing remains).
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS pesel text;

UPDATE medical_records
SET
  pesel = substring(notes from '^PESEL: ([0-9]{11})'),
  notes = nullif(regexp_replace(notes, '^PESEL: [0-9]{11}\n?', ''), '')
WHERE notes ~ '^PESEL: [0-9]{11}';
