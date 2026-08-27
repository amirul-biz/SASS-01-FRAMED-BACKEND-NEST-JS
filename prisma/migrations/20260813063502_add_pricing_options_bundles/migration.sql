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

-- CreateIndex
CREATE INDEX "idx_pricing_options_photographer" ON "pricing_options"("photographer_id");

-- CreateIndex
CREATE INDEX "idx_pricing_bundles_photographer" ON "pricing_bundles"("photographer_id");
