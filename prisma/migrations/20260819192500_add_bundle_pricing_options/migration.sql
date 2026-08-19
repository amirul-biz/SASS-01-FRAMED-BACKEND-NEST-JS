-- AlterTable
ALTER TABLE "pricing_bundles" DROP COLUMN "base_price";

-- CreateTable
CREATE TABLE "bundle_pricing_options" (
    "pricing_bundle_id" TEXT NOT NULL,
    "pricing_option_id" TEXT NOT NULL,

    CONSTRAINT "bundle_pricing_options_pkey" PRIMARY KEY ("pricing_bundle_id","pricing_option_id")
);

-- AddForeignKey
ALTER TABLE "bundle_pricing_options" ADD CONSTRAINT "bundle_pricing_options_pricing_bundle_id_fkey" FOREIGN KEY ("pricing_bundle_id") REFERENCES "pricing_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_pricing_options" ADD CONSTRAINT "bundle_pricing_options_pricing_option_id_fkey" FOREIGN KEY ("pricing_option_id") REFERENCES "pricing_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
