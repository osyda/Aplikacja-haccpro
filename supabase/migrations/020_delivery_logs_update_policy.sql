-- Allow correcting existing delivery log entries (e.g. fixing a
-- misentered temperature reading) within the same org's locations.
create policy "delivery_logs_update" on delivery_logs for update using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
