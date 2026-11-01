-- AlterTable
-- Set when ToyyibPay confirmed the merchant's categoryCode + secretKey; null = never verified.
ALTER TABLE "merchant_toyyibpay_payment_platform_options" ADD COLUMN "verified_at" TIMESTAMP(3);

-- AlterTable
-- categoryCode is what getCategoryDetails needs to verify a system account's secret key.
ALTER TABLE "system_toyyibpay_payment_platform_accounts" ADD COLUMN "category_code" TEXT,
ADD COLUMN "verified_at" TIMESTAMP(3);
