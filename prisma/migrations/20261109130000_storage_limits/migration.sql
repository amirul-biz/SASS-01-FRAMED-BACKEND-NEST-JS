-- CreateTable
CREATE TABLE "storage_limits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit_mb" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_limits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "storage_limits_limit_mb_positive_check" CHECK ("limit_mb" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_limits_name_key" ON "storage_limits"("name");

-- AlterTable
-- Null = unlimited.
ALTER TABLE "photographer_profiles" ADD COLUMN "storage_limit_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_photographer_profiles_storage_limit" ON "photographer_profiles"("storage_limit_id");

-- AddForeignKey
ALTER TABLE "photographer_profiles" ADD CONSTRAINT "photographer_profiles_storage_limit_id_fkey" FOREIGN KEY ("storage_limit_id") REFERENCES "storage_limits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
