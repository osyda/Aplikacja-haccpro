-- Some deliveries mix frozen goods with chilled/fresh products that have a
-- different temperature norm. A single reading can't represent both, so this
-- adds a second column for the frozen-goods temperature when both are recorded.
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS temp_frozen numeric(5,1);
