-- Add department assignment to cleaning tasks
alter table cleaning_tasks add column if not exists dept text check (dept in ('kitchen_back', 'service_hall'));
