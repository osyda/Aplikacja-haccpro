-- ============================================================
-- Audit Log — scope to location/org
-- ============================================================
-- audit_log previously had `for select using (true)`, which let any
-- authenticated user read audit entries (including full old_data /
-- new_data row snapshots) from EVERY organization. This adds a
-- location_id column, backfills it from the existing row snapshots,
-- populates it going forward via fn_audit_trigger(), and restricts
-- select access to the caller's own org.

alter table audit_log add column if not exists location_id uuid references locations(id) on delete cascade;

update audit_log
set location_id = coalesce(
  (new_data->>'location_id')::uuid,
  (old_data->>'location_id')::uuid
)
where location_id is null;

create index if not exists audit_log_location_idx on audit_log(location_id);

create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  row_location_id uuid;
begin
  row_location_id := coalesce(
    case when TG_OP != 'DELETE' then (to_jsonb(NEW)->>'location_id')::uuid else null end,
    case when TG_OP != 'INSERT' then (to_jsonb(OLD)->>'location_id')::uuid else null end
  );

  insert into audit_log (table_name, record_id, action, old_data, new_data, changed_by, location_id)
  values (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    auth.uid(),
    row_location_id
  );
  return coalesce(NEW, OLD);
end;
$$;

drop policy if exists "audit_log_select_own_org" on audit_log;

create policy "audit_log_select_own_location" on audit_log for select using (
  location_id in (select id from locations where org_id = fn_my_org_id())
);
