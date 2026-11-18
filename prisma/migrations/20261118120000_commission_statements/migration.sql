-- CreateEnum
CREATE TYPE "commission_statement_status" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "commission_statements" (
    "id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "status" "commission_statement_status" NOT NULL DEFAULT 'UNPAID',
    "amount_paid" DECIMAL(10,2),
    "paid_at" TIMESTAMP(3),
    "marked_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_statements_pkey" PRIMARY KEY ("id"),
    -- period must be the first day of a month
    CONSTRAINT "commission_statements_period_first_day_check" CHECK (EXTRACT(DAY FROM "period") = 1)
);

-- CreateTable
CREATE TABLE "commission_statement_attachments" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_statement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_commission_statements_photographer_period" ON "commission_statements"("photographer_id", "period");

-- CreateIndex
CREATE INDEX "idx_commission_statement_attachments_statement" ON "commission_statement_attachments"("statement_id");

-- AddForeignKey
ALTER TABLE "commission_statements" ADD CONSTRAINT "commission_statements_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "photographer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_statement_attachments" ADD CONSTRAINT "commission_statement_attachments_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "commission_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
