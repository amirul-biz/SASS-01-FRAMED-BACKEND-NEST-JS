-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PHOTOGRAPHER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_platforms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photographer_profiles" (
    "id" TEXT NOT NULL,
    "user_platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "company_name" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photographer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "user_platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_id_key" ON "users"("firebase_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_platforms_user" ON "user_platforms"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_platforms_user_id_role_key" ON "user_platforms"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "photographer_profiles_user_platform_id_key" ON "photographer_profiles"("user_platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_user_platform_id_key" ON "admin_profiles"("user_platform_id");

-- AddForeignKey
ALTER TABLE "user_platforms" ADD CONSTRAINT "user_platforms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photographer_profiles" ADD CONSTRAINT "photographer_profiles_user_platform_id_fkey" FOREIGN KEY ("user_platform_id") REFERENCES "user_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_platform_id_fkey" FOREIGN KEY ("user_platform_id") REFERENCES "user_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
