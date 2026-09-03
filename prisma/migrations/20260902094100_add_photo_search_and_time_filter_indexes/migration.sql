-- Enables trigram (fuzzy substring) search on original_name without a full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Time-of-day in minutes since midnight, derived from the stored EXIF wall clock
-- (captured_at is TIMESTAMP(3) without timezone). Lets "10:00-11:00" filters work across a
-- multi-day event without a per-row date computation on every query.
ALTER TABLE "photos"
  ADD COLUMN "captured_minute_of_day" INTEGER
  GENERATED ALWAYS AS (
    EXTRACT(HOUR FROM "captured_at")::int * 60 + EXTRACT(MINUTE FROM "captured_at")::int
  ) STORED;

-- Kills the per-page full-table sort on the public event photo list: previously only
-- idx_photos_event_status existed, so findMany's ORDER BY captured_at/uploaded_at had to sort
-- every live row for the event before slicing off a page. "id" is a stable tiebreaker for
-- offset pagination, since captured_at/uploaded_at are neither unique nor always distinct.
CREATE INDEX "idx_photos_event_status_order"
  ON "photos" ("event_id", "status", "captured_at", "uploaded_at", "id")
  WHERE "deleted_at" IS NULL;

-- Supports the new capturedFrom/capturedTo time-of-day filter.
CREATE INDEX "idx_photos_event_captured_minute"
  ON "photos" ("event_id", "status", "captured_minute_of_day")
  WHERE "deleted_at" IS NULL;

-- Supports the new filename search (case-insensitive substring match) via GIN + pg_trgm.
CREATE INDEX "idx_photos_original_name_trgm"
  ON "photos" USING GIN ("original_name" gin_trgm_ops);
