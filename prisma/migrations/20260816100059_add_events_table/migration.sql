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

-- CreateTable
CREATE TABLE "event_pricing_bundles" (
    "event_id" TEXT NOT NULL,
    "pricing_bundle_id" TEXT NOT NULL,

    CONSTRAINT "event_pricing_bundles_pkey" PRIMARY KEY ("event_id","pricing_bundle_id")
);

-- AddForeignKey
ALTER TABLE "event_pricing_bundles" ADD CONSTRAINT "event_pricing_bundles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_pricing_bundles" ADD CONSTRAINT "event_pricing_bundles_pricing_bundle_id_fkey" FOREIGN KEY ("pricing_bundle_id") REFERENCES "pricing_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
