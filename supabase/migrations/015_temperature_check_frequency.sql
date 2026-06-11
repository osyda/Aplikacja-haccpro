-- Configurable temperature-check frequency per location: 1x or 2x daily,
-- with an adjustable hour that splits the morning and afternoon check windows.

alter table locations add column if not exists temp_checks_per_day smallint not null default 1 check (temp_checks_per_day in (1, 2));
alter table locations add column if not exists temp_check_split_hour smallint not null default 14 check (temp_check_split_hour between 0 and 23);
