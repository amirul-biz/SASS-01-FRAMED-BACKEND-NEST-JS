-- AlterTable
ALTER TABLE "events" ADD COLUMN     "publish_until" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "description" TEXT;
