-- CreateEnum
CREATE TYPE "country_code" AS ENUM ('60', '65');

-- AlterTable: convert existing free-text country_code ('+60', '+65') into the new enum
ALTER TABLE "orders"
  ALTER COLUMN "country_code" TYPE "country_code"
  USING (ltrim("country_code", '+')::"country_code");

-- AlterTable: add price_breakdown, backfilled from the existing subtotal/discount_amount/total columns
ALTER TABLE "orders" ADD COLUMN "price_breakdown" JSONB;
UPDATE "orders" SET "price_breakdown" = jsonb_build_object(
  'subtotal', "subtotal",
  'discountAmount', "discount_amount",
  'total', "total"
);
ALTER TABLE "orders" ALTER COLUMN "price_breakdown" SET NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "voucher_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_orders_voucher" ON "orders"("voucher_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
