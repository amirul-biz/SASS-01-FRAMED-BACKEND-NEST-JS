-- Replace full-URL columns with R2 object key columns. The public URL is now built on read via
-- PublicStorageService.buildPublicUrl(key). Existing values are intentionally not migrated —
-- rows with a null key simply render no image on the frontend.
ALTER TABLE "photographer_profiles" DROP COLUMN "profile_image_url";
ALTER TABLE "photographer_profiles" DROP COLUMN "banner_url";
ALTER TABLE "photographer_profiles" ADD COLUMN "profile_image_key" TEXT;
ALTER TABLE "photographer_profiles" ADD COLUMN "banner_key" TEXT;

ALTER TABLE "events" DROP COLUMN "cover_photo_url";
ALTER TABLE "events" ADD COLUMN "cover_photo_key" TEXT;
