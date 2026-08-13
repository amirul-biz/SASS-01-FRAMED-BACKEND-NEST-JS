-- CreateEnum
CREATE TYPE "bundle_model" AS ENUM ('FLAT_TIER', 'PERCENT_TIER', 'NONE');

-- CreateTable
CREATE TABLE "pricing_options" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_bundles" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "bundle_model" "bundle_model" NOT NULL,
    "bundle_tiers" JSONB NOT NULL,
    "full_gallery_enabled" BOOLEAN NOT NULL DEFAULT false,
    "full_gallery_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_pricing_bundles" (
    "event_id" TEXT NOT NULL,
    "pricing_bundle_id" TEXT NOT NULL,

    CONSTRAINT "event_pricing_bundles_pkey" PRIMARY KEY ("event_id","pricing_bundle_id")
);

-- CreateIndex
CREATE INDEX "idx_pricing_options_photographer" ON "pricing_options"("photographer_id");

-- CreateIndex
CREATE INDEX "idx_pricing_bundles_photographer" ON "pricing_bundles"("photographer_id");

-- AddForeignKey
ALTER TABLE "event_pricing_bundles" ADD CONSTRAINT "event_pricing_bundles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_pricing_bundles" ADD CONSTRAINT "event_pricing_bundles_pricing_bundle_id_fkey" FOREIGN KEY ("pricing_bundle_id") REFERENCES "pricing_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
