-- CreateEnum
CREATE TYPE "photo_upload_status" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" "photo_upload_status" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photos_key_key" ON "photos"("key");

-- CreateIndex (partial: only live rows, matches the events table's soft-delete index pattern)
CREATE INDEX "idx_photos_event_status" ON "photos"("event_id", "status") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
