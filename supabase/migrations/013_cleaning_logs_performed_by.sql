-- Who physically performed the cleaning (may differ from the logged-in user who recorded it)
alter table cleaning_logs add column if not exists performed_by text;
