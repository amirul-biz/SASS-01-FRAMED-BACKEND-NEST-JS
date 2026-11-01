-- AlterTable
ALTER TABLE "commission_plans" ADD COLUMN     "provider" "payment_provider";

-- AlterTable
ALTER TABLE "merchant_payment_platform_options" ADD COLUMN     "approval_status_updated_at" TIMESTAMP(3),
ADD COLUMN     "approval_status_updated_by_user_platform_id" TEXT;

-- AddForeignKey
ALTER TABLE "merchant_payment_platform_options" ADD CONSTRAINT "merchant_payment_platform_options_approval_status_updated__fkey" FOREIGN KEY ("approval_status_updated_by_user_platform_id") REFERENCES "user_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (partial: Prisma cannot express these)
-- At most one default plan per provider...
CREATE UNIQUE INDEX "commission_plans_default_per_provider_key" ON "commission_plans"("provider") WHERE "is_default" = true AND "provider" IS NOT NULL;

-- CreateIndex
-- ...plus at most one provider-agnostic default (provider IS NULL), the fallback when a provider has none.
CREATE UNIQUE INDEX "commission_plans_default_any_provider_key" ON "commission_plans"("is_default") WHERE "is_default" = true AND "provider" IS NULL;

-- CreateIndex
-- At most one default system payment platform per provider.
CREATE UNIQUE INDEX "system_payment_platforms_default_per_provider_key" ON "system_payment_platforms"("provider") WHERE "is_default" = true;
