-- Allow owners/managers to permanently delete a delivery log entry
-- (e.g. one created entirely by mistake) within their own org's locations.
create policy "delivery_logs_delete" on delivery_logs for delete using (
  location_id in (select id from locations where org_id = fn_my_org_id())
  and (select role from profiles where id = auth.uid() limit 1) in ('owner', 'manager')
);
