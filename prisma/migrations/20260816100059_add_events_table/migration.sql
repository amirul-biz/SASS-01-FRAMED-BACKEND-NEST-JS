-- CreateEnum
CREATE TYPE "event_category" AS ENUM ('CYCLING', 'RUNNING', 'SWIMMING', 'TRIATHLON', 'MOTORSPORT', 'OTHER');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "event_category" NOT NULL,
    "location" VARCHAR(255),
    "event_start_date" TIMESTAMPTZ(6) NOT NULL,
    "event_end_date" TIMESTAMPTZ(6) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "cover_photo_url" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "events_date_range_check" CHECK ("event_end_date" >= "event_start_date")
);

-- CreateIndex (partial: only live rows)
CREATE INDEX "idx_events_photographer" ON "events"("photographer_id") WHERE "deleted_at" IS NULL;

-- CreateIndex (partial: only live rows, for the published-events listing query)
CREATE INDEX "idx_events_published" ON "events"("is_published", "event_start_date" DESC) WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "photographer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
