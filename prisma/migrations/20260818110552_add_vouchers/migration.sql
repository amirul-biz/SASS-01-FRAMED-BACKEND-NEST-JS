-- AlterTable
ALTER TABLE "pricing_bundles" DROP COLUMN "bundle_model",
DROP COLUMN "bundle_tiers";

-- DropEnum
DROP TYPE "bundle_model";

-- CreateEnum
CREATE TYPE "voucher_discount_type" AS ENUM ('FLAT_TIER', 'PERCENT_TIER');

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount_type" "voucher_discount_type" NOT NULL,
    "conditions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_vouchers" (
    "pricing_bundle_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,

    CONSTRAINT "bundle_vouchers_pkey" PRIMARY KEY ("pricing_bundle_id","voucher_id")
);

-- CreateIndex
CREATE INDEX "idx_vouchers_photographer" ON "vouchers"("photographer_id");

-- AddForeignKey
ALTER TABLE "bundle_vouchers" ADD CONSTRAINT "bundle_vouchers_pricing_bundle_id_fkey" FOREIGN KEY ("pricing_bundle_id") REFERENCES "pricing_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_vouchers" ADD CONSTRAINT "bundle_vouchers_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
