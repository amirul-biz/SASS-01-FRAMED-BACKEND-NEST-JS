-- Optional, unique vanity-URL slug for a photographer's public profile page.
ALTER TABLE "photographer_profiles" ADD COLUMN "nickname" TEXT;
CREATE UNIQUE INDEX "photographer_profiles_nickname_key" ON "photographer_profiles"("nickname");
