-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('TOYYIBPAY', 'STRIPE', 'CASH');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "toyyibpay_channel" AS ENUM ('FPX', 'CARD', 'BOTH');

-- CreateTable
CREATE TABLE "user_platform_payment_accounts" (
    "id" TEXT NOT NULL,
    "user_platform_id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "is_default_payment_platform" BOOLEAN NOT NULL DEFAULT false,
    "approval_status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "is_impose_commission" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_platform_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toyyibpay_merchant_accounts" (
    "id" TEXT NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "charge_fpx_to_customer" BOOLEAN NOT NULL DEFAULT false,
    "charge_to_prepaid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toyyibpay_merchant_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_merchant_accounts" (
    "id" TEXT NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_merchant_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_payment_platform_bills" (
    "id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_payment_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toyyibpay_merchant_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "bill_code" TEXT NOT NULL,
    "api_version" TEXT NOT NULL DEFAULT 'v1',
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toyyibpay_merchant_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_merchant_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "recorded_by_user_platform_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_merchant_bills_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "toyyibpay_system_platform_accounts" (
    "id" TEXT NOT NULL,
    "system_platform_id" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "split_recipient_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toyyibpay_system_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_system_platform_accounts" (
    "id" TEXT NOT NULL,
    "system_platform_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_system_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toyyibpay_system_platform_categories" (
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

    CONSTRAINT "toyyibpay_system_platform_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_platform_bills" (
    "id" TEXT NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toyyibpay_system_platform_bills" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "bill_code" TEXT NOT NULL,
    "api_version" TEXT NOT NULL DEFAULT 'v1',
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toyyibpay_system_platform_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "percentage_commission_id" TEXT,
    "amount_commission_id" TEXT,

    CONSTRAINT "commission_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "percentage_commissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage_value" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "percentage_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amount_commissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_value" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amount_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_assignments" (
    "id" TEXT NOT NULL,
    "commission_plan_id" TEXT NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_toyyibpay_merchants" (
    "id" TEXT NOT NULL,
    "commission_assignment_id" TEXT NOT NULL,
    "merchant_toyyibpay_account_id" TEXT NOT NULL,
    "system_toyyibpay_platform_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_toyyibpay_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charges" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "commission_plan_id" TEXT,
    "percentage_value_applied" DECIMAL(5,2),
    "amount_value_applied" DECIMAL(10,2),
    "total_commission_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_platform_payment_accounts_user_platform_id_provider_key" ON "user_platform_payment_accounts"("user_platform_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_merchant_accounts_payment_account_id_key" ON "toyyibpay_merchant_accounts"("payment_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_merchant_accounts_payment_account_id_key" ON "cash_merchant_accounts"("payment_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_merchant_bills_bill_id_key" ON "toyyibpay_merchant_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_merchant_bills_bill_code_key" ON "toyyibpay_merchant_bills"("bill_code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_merchant_bills_bill_id_key" ON "cash_merchant_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_system_platform_accounts_system_platform_id_key" ON "toyyibpay_system_platform_accounts"("system_platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_system_platform_accounts_system_platform_id_key" ON "cash_system_platform_accounts"("system_platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_system_platform_categories_category_code_key" ON "toyyibpay_system_platform_categories"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_system_platform_bills_bill_id_key" ON "toyyibpay_system_platform_bills"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "toyyibpay_system_platform_bills_bill_code_key" ON "toyyibpay_system_platform_bills"("bill_code");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_percentage_commission_id_key" ON "commission_plans"("percentage_commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_plans_amount_commission_id_key" ON "commission_plans"("amount_commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_assignments_payment_account_id_key" ON "commission_assignments"("payment_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_toyyibpay_merchants_commission_assignment_id_key" ON "commission_toyyibpay_merchants"("commission_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_toyyibpay_merchants_merchant_toyyibpay_account_i_key" ON "commission_toyyibpay_merchants"("merchant_toyyibpay_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charges_bill_id_key" ON "commission_charges"("bill_id");

-- AddForeignKey
ALTER TABLE "user_platform_payment_accounts" ADD CONSTRAINT "user_platform_payment_accounts_user_platform_id_fkey" FOREIGN KEY ("user_platform_id") REFERENCES "user_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_merchant_accounts" ADD CONSTRAINT "toyyibpay_merchant_accounts_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "user_platform_payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_merchant_accounts" ADD CONSTRAINT "cash_merchant_accounts_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "user_platform_payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_payment_platform_bills" ADD CONSTRAINT "merchant_payment_platform_bills_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "user_platform_payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_merchant_bills" ADD CONSTRAINT "toyyibpay_merchant_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "merchant_payment_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_merchant_bills" ADD CONSTRAINT "cash_merchant_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "merchant_payment_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_merchant_bills" ADD CONSTRAINT "cash_merchant_bills_recorded_by_user_platform_id_fkey" FOREIGN KEY ("recorded_by_user_platform_id") REFERENCES "user_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_system_platform_accounts" ADD CONSTRAINT "toyyibpay_system_platform_accounts_system_platform_id_fkey" FOREIGN KEY ("system_platform_id") REFERENCES "system_payment_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_system_platform_accounts" ADD CONSTRAINT "cash_system_platform_accounts_system_platform_id_fkey" FOREIGN KEY ("system_platform_id") REFERENCES "system_payment_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_system_platform_categories" ADD CONSTRAINT "toyyibpay_system_platform_categories_system_platform_accou_fkey" FOREIGN KEY ("system_platform_account_id") REFERENCES "toyyibpay_system_platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_system_platform_bills" ADD CONSTRAINT "toyyibpay_system_platform_bills_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "system_platform_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toyyibpay_system_platform_bills" ADD CONSTRAINT "toyyibpay_system_platform_bills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "toyyibpay_system_platform_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_percentage_commission_id_fkey" FOREIGN KEY ("percentage_commission_id") REFERENCES "percentage_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_amount_commission_id_fkey" FOREIGN KEY ("amount_commission_id") REFERENCES "amount_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_commission_plan_id_fkey" FOREIGN KEY ("commission_plan_id") REFERENCES "commission_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "user_platform_payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchants" ADD CONSTRAINT "commission_toyyibpay_merchants_commission_assignment_id_fkey" FOREIGN KEY ("commission_assignment_id") REFERENCES "commission_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchants" ADD CONSTRAINT "commission_toyyibpay_merchants_merchant_toyyibpay_account__fkey" FOREIGN KEY ("merchant_toyyibpay_account_id") REFERENCES "toyyibpay_merchant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_toyyibpay_merchants" ADD CONSTRAINT "commission_toyyibpay_merchants_system_toyyibpay_platform_a_fkey" FOREIGN KEY ("system_toyyibpay_platform_account_id") REFERENCES "toyyibpay_system_platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charges" ADD CONSTRAINT "commission_charges_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "merchant_payment_platform_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charges" ADD CONSTRAINT "commission_charges_commission_plan_id_fkey" FOREIGN KEY ("commission_plan_id") REFERENCES "commission_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
