-- Payment layer + order payment layer, generated as ONE step from staging's schema (origin/staging,
-- last migration 20260911131604_add_photographer_nickname) to this branch's schema.
--
-- Legacy-data safety (staging holds all the legacy rows):
--   * Every table below is NEW and starts empty. Only one legacy table gets a column added
--     (orders.idempotency_key, see below) — order_items, users, user_platforms, events, photos,
--     ... stay untouched.
--   * The foreign keys into legacy tables (user_platforms, orders) sit on the new tables, so they
--     cannot fail on existing rows. Legacy orders simply have no payment row.
--   * The only legacy object changed is the "order_status" enum, renamed IN PLACE so existing
--     orders keep their row and the column default: CONFIRMED -> DELIVERED, plus PROCESSING.
--     (Prisma's generated drop/recreate of the enum is not used.)
--   * "orders"."idempotency_key" is a nullable, unique TEXT column added to the existing legacy
--     table — every existing row gets NULL (Postgres allows many NULLs under a unique constraint,
--     so this cannot collide or fail), and only new orders from here on ever set it.
--   * "merchant_payment_platform_bills"."payment_id" is nullable and unique (Postgres allows many NULLs).
-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('TOYYIBPAY', 'STRIPE', 'CASH');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "toyyibpay_channel" AS ENUM ('FPX', 'CARD', 'BOTH');

-- CreateEnum
CREATE TYPE "payment_bill_status" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "transition_source" AS ENUM ('WEBHOOK', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "commission_type" AS ENUM ('PERCENTAGE_PER_TRANSACTION', 'AMOUNT_PER_TRANSACTION', 'PERCENTAGE_PER_UNIT', 'AMOUNT_PER_UNIT');

-- AlterEnum
-- RENAME VALUE / ADD VALUE keep every existing order row; the new value is not used in this migration.
ALTER TYPE "order_status" RENAME VALUE 'CONFIRMED' TO 'DELIVERED';
ALTER TYPE "order_status" ADD VALUE 'PROCESSING';

-- AlterTable (legacy table — nullable, so every existing row is unaffected)
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateTable
CREATE TABLE "merchant_payment_platform_options" (
    "id" TEXT NOT NULL,
    "user_platform_id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "is_default_payment_platform" BOOLEAN NOT NULL DEFAULT false,
    "approval_status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "is_impose_commission" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_payment_platform_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_toyyibpay_payment_platform_options" (
    "id" TEXT NOT NULL,
    "payment_platform_option_id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "charge_fpx_to_customer" BOOLEAN NOT NULL DEFAULT false,
    "charge_to_prepaid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_toyyibpay_payment_platform_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_cash_payment_platform_options" (
    "id" TEXT NOT NULL,
    "payment_platform_option_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_cash_payment_platform_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "merchant_payment_platform_option_id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "payment_bill_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_transaction_audit_logs" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "payment_bill_status",
    "to_status" "payment_bill_status" NOT NULL,
    "from_order_status" "order_status",
    "to_order_status" "order_status" NOT NULL,
    "source" "transition_source" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_transaction_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT,
    "provider" "payment_provider" NOT NULL,
    "payment_platform_option_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_toyyibpay_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "bill_code" TEXT NOT NULL,
    "api_version" TEXT NOT NULL DEFAULT 'v1',
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "split_recipient_username" TEXT,
    "split_commission" JSONB,

    CONSTRAINT "merchant_toyyibpay_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_cash_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "recorded_by_user_platform_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_cash_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_payment_platforms" (
    "id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_payment_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_toyyibpay_payment_platform_accounts" (
    "id" TEXT NOT NULL,
    "system_platform_id" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "split_recipient_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_toyyibpay_payment_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_cash_payment_platform_accounts" (
    "id" TEXT NOT NULL,
    "system_platform_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_cash_payment_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_toyyibpay_payment_platform_categories" (
    "id" TEXT NOT NULL,
    "system_platform_account_id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payment_channel" "toyyibpay_channel" NOT NULL DEFAULT 'FPX',
    "charge_fpx_to_customer" BOOLEAN NOT NULL DEFAULT false,
    "charge_to_prepaid" BOOLEAN NOT NULL DEFAULT false,
    "enable_fpx_b2b" BOOLEAN NOT NULL DEFAULT false,
    "charge_fpx_b2b_to_owner" BOOLEAN NOT NULL DEFAULT true,
    "enable_duitnow_qr" BOOLEAN NOT NULL DEFAULT false,
    "charge_duitnow_qr_to_customer" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_toyyibpay_payment_platform_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_toyyibpay_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "bill_code" TEXT NOT NULL,
    "api_version" TEXT NOT NULL DEFAULT 'v1',
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_toyyibpay_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "commission_type" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "percentage_commission_per_transaction_id" TEXT,
    "amount_commission_per_transaction_id" TEXT,
    "percentage_commission_per_unit_id" TEXT,
    "amount_commission_per_unit_id" TEXT,

    CONSTRAINT "commission_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "percentage_commission_per_transactions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage_value" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "percentage_commission_per_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amount_commission_per_transactions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_value" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amount_commission_per_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "percentage_commission_per_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage_value" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "percentage_commission_per_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amount_commission_per_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_value" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amount_commission_per_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_assignments" (
    "id" TEXT NOT NULL,
    "commission_plan_id" TEXT NOT NULL,
    "payment_platform_option_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_toyyibpay_merchant_options" (
    "id" TEXT NOT NULL,
    "commission_assignment_id" TEXT NOT NULL,
    "toyyibpay_payment_platform_option_id" TEXT NOT NULL,
    "system_toyyibpay_platform_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_toyyibpay_merchant_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charges" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "commission_plan_id" TEXT,
    "commission_type" "commission_type" NOT NULL,
    "original_payment_amount" DECIMAL(10,2) NOT NULL,
    "commission_base_amount" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "commission_imposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charge_percentage_per_transactions" (
    "id" TEXT NOT NULL,
    "commission_charge_id" TEXT NOT NULL,
    "percentage_rate_applied" DECIMAL(5,2) NOT NULL,
    "transaction_amount" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charge_percentage_per_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charge_amount_per_transactions" (
    "id" TEXT NOT NULL,
    "commission_charge_id" TEXT NOT NULL,
    "flat_amount_applied" DECIMAL(10,2) NOT NULL,
    "transaction_amount" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charge_amount_per_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charge_percentage_per_units" (
    "id" TEXT NOT NULL,
    "commission_charge_id" TEXT NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "total_unit_cost" DECIMAL(10,2) NOT NULL,
    "average_cost_per_unit" DECIMAL(10,2) NOT NULL,
    "percentage_rate_applied" DECIMAL(5,2) NOT NULL,
    "average_commission_per_unit" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charge_percentage_per_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charge_amount_per_units" (
    "id" TEXT NOT NULL,
    "commission_charge_id" TEXT NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "total_unit_cost" DECIMAL(10,2) NOT NULL,
    "average_cost_per_unit" DECIMAL(10,2) NOT NULL,
    "commission_per_unit_applied" DECIMAL(10,2) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charge_amount_per_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_payment_platform_options_user_platform_id_provider_key" ON "merchant_payment_platform_options"("user_platform_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_toyyibpay_payment_platform_options_payment_platfor_key" ON "merchant_toyyibpay_payment_platform_options"("payment_platform_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_cash_payment_platform_options_payment_platform_opt_key" ON "merchant_cash_payment_platform_options"("payment_platform_option_id");

-- CreateIndex
CREATE INDEX "idx_merchant_payments_order" ON "merchant_payments"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_transaction_audit_logs_payment_id_to_status_key" ON "merchant_transaction_audit_logs"("payment_id", "to_status");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_payment_platform_bills_payment_id_key" ON "merchant_payment_platform_bills"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_toyyibpay_payment_platform_bills_bill_id_key" ON "merchant_toyyibpay_payment_platform_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_toyyibpay_payment_platform_bills_bill_code_key" ON "merchant_toyyibpay_payment_platform_bills"("bill_code");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_cash_payment_platform_bills_bill_id_key" ON "merchant_cash_payment_platform_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_toyyibpay_payment_platform_accounts_system_platform__key" ON "system_toyyibpay_payment_platform_accounts"("system_platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_cash_payment_platform_accounts_system_platform_id_key" ON "system_cash_payment_platform_accounts"("system_platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_toyyibpay_payment_platform_categories_category_code_key" ON "system_toyyibpay_payment_platform_categories"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "system_toyyibpay_payment_platform_bills_bill_id_key" ON "system_toyyibpay_payment_platform_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_toyyibpay_payment_platform_bills_bill_code_key" ON "system_toyyibpay_payment_platform_bills"("bill_code");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_percentage_commission_per_transaction_id_key" ON "commission_plans"("percentage_commission_per_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_amount_commission_per_transaction_id_key" ON "commission_plans"("amount_commission_per_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_percentage_commission_per_unit_id_key" ON "commission_plans"("percentage_commission_per_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_amount_commission_per_unit_id_key" ON "commission_plans"("amount_commission_per_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_assignments_payment_platform_option_id_key" ON "commission_assignments"("payment_platform_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_toyyibpay_merchant_options_commission_assignment_key" ON "commission_toyyibpay_merchant_options"("commission_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_toyyibpay_merchant_options_toyyibpay_payment_pla_key" ON "commission_toyyibpay_merchant_options"("toyyibpay_payment_platform_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charges_payment_id_key" ON "commission_charges"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charge_percentage_per_transactions_commission_ch_key" ON "commission_charge_percentage_per_transactions"("commission_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charge_amount_per_transactions_commission_charge_key" ON "commission_charge_amount_per_transactions"("commission_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charge_percentage_per_units_commission_charge_id_key" ON "commission_charge_percentage_per_units"("commission_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charge_amount_per_units_commission_charge_id_key" ON "commission_charge_amount_per_units"("commission_charge_id");

-- AddForeignKey
ALTER TABLE "merchant_payment_platform_options" ADD CONSTRAINT "merchant_payment_platform_options_user_platform_id_fkey" FOREIGN KEY ("user_platform_id") REFERENCES "user_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_toyyibpay_payment_platform_options" ADD CONSTRAINT "merchant_toyyibpay_payment_platform_options_payment_platfo_fkey" FOREIGN KEY ("payment_platform_option_id") REFERENCES "merchant_payment_platform_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_cash_payment_platform_options" ADD CONSTRAINT "merchant_cash_payment_platform_options_payment_platform_op_fkey" FOREIGN KEY ("payment_platform_option_id") REFERENCES "merchant_payment_platform_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payments" ADD CONSTRAINT "merchant_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payments" ADD CONSTRAINT "merchant_payments_merchant_payment_platform_option_id_fkey" FOREIGN KEY ("merchant_payment_platform_option_id") REFERENCES "merchant_payment_platform_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_transaction_audit_logs" ADD CONSTRAINT "merchant_transaction_audit_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "merchant_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_transaction_audit_logs" ADD CONSTRAINT "merchant_transaction_audit_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payment_platform_bills" ADD CONSTRAINT "merchant_payment_platform_bills_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "merchant_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payment_platform_bills" ADD CONSTRAINT "merchant_payment_platform_bills_payment_platform_option_id_fkey" FOREIGN KEY ("payment_platform_option_id") REFERENCES "merchant_payment_platform_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_toyyibpay_payment_platform_bills" ADD CONSTRAINT "merchant_toyyibpay_payment_platform_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "merchant_payment_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_cash_payment_platform_bills" ADD CONSTRAINT "merchant_cash_payment_platform_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "merchant_payment_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_cash_payment_platform_bills" ADD CONSTRAINT "merchant_cash_payment_platform_bills_recorded_by_user_plat_fkey" FOREIGN KEY ("recorded_by_user_platform_id") REFERENCES "user_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_toyyibpay_payment_platform_accounts" ADD CONSTRAINT "system_toyyibpay_payment_platform_accounts_system_platform_fkey" FOREIGN KEY ("system_platform_id") REFERENCES "system_payment_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_cash_payment_platform_accounts" ADD CONSTRAINT "system_cash_payment_platform_accounts_system_platform_id_fkey" FOREIGN KEY ("system_platform_id") REFERENCES "system_payment_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_toyyibpay_payment_platform_categories" ADD CONSTRAINT "system_toyyibpay_payment_platform_categories_system_platfo_fkey" FOREIGN KEY ("system_platform_account_id") REFERENCES "system_toyyibpay_payment_platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_toyyibpay_payment_platform_bills" ADD CONSTRAINT "system_toyyibpay_payment_platform_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "system_payment_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_toyyibpay_payment_platform_bills" ADD CONSTRAINT "system_toyyibpay_payment_platform_bills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "system_toyyibpay_payment_platform_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_percentage_commission_per_transaction_id_fkey" FOREIGN KEY ("percentage_commission_per_transaction_id") REFERENCES "percentage_commission_per_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_amount_commission_per_transaction_id_fkey" FOREIGN KEY ("amount_commission_per_transaction_id") REFERENCES "amount_commission_per_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_percentage_commission_per_unit_id_fkey" FOREIGN KEY ("percentage_commission_per_unit_id") REFERENCES "percentage_commission_per_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_amount_commission_per_unit_id_fkey" FOREIGN KEY ("amount_commission_per_unit_id") REFERENCES "amount_commission_per_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_commission_plan_id_fkey" FOREIGN KEY ("commission_plan_id") REFERENCES "commission_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_payment_platform_option_id_fkey" FOREIGN KEY ("payment_platform_option_id") REFERENCES "merchant_payment_platform_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchant_options" ADD CONSTRAINT "commission_toyyibpay_merchant_options_commission_assignmen_fkey" FOREIGN KEY ("commission_assignment_id") REFERENCES "commission_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchant_options" ADD CONSTRAINT "commission_toyyibpay_merchant_options_toyyibpay_payment_pl_fkey" FOREIGN KEY ("toyyibpay_payment_platform_option_id") REFERENCES "merchant_toyyibpay_payment_platform_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchant_options" ADD CONSTRAINT "commission_toyyibpay_merchant_options_system_toyyibpay_pla_fkey" FOREIGN KEY ("system_toyyibpay_platform_account_id") REFERENCES "system_toyyibpay_payment_platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charges" ADD CONSTRAINT "commission_charges_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "merchant_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charges" ADD CONSTRAINT "commission_charges_commission_plan_id_fkey" FOREIGN KEY ("commission_plan_id") REFERENCES "commission_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charge_percentage_per_transactions" ADD CONSTRAINT "commission_charge_percentage_per_transactions_commission_c_fkey" FOREIGN KEY ("commission_charge_id") REFERENCES "commission_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charge_amount_per_transactions" ADD CONSTRAINT "commission_charge_amount_per_transactions_commission_charg_fkey" FOREIGN KEY ("commission_charge_id") REFERENCES "commission_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charge_percentage_per_units" ADD CONSTRAINT "commission_charge_percentage_per_units_commission_charge_i_fkey" FOREIGN KEY ("commission_charge_id") REFERENCES "commission_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charge_amount_per_units" ADD CONSTRAINT "commission_charge_amount_per_units_commission_charge_id_fkey" FOREIGN KEY ("commission_charge_id") REFERENCES "commission_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
-- A commission plan's "type" must match exactly one linked value row (Prisma cannot express this).
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_type_matches_value_check" CHECK (
  ("type" = 'PERCENTAGE_PER_TRANSACTION' AND "percentage_commission_per_transaction_id" IS NOT NULL AND "amount_commission_per_transaction_id" IS NULL AND "percentage_commission_per_unit_id" IS NULL AND "amount_commission_per_unit_id" IS NULL)
  OR ("type" = 'AMOUNT_PER_TRANSACTION' AND "amount_commission_per_transaction_id" IS NOT NULL AND "percentage_commission_per_transaction_id" IS NULL AND "percentage_commission_per_unit_id" IS NULL AND "amount_commission_per_unit_id" IS NULL)
  OR ("type" = 'PERCENTAGE_PER_UNIT' AND "percentage_commission_per_unit_id" IS NOT NULL AND "percentage_commission_per_transaction_id" IS NULL AND "amount_commission_per_transaction_id" IS NULL AND "amount_commission_per_unit_id" IS NULL)
  OR ("type" = 'AMOUNT_PER_UNIT' AND "amount_commission_per_unit_id" IS NOT NULL AND "percentage_commission_per_transaction_id" IS NULL AND "amount_commission_per_transaction_id" IS NULL AND "percentage_commission_per_unit_id" IS NULL)
);
