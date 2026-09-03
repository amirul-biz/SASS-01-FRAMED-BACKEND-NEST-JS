-- Seed: 7 dummy photographers for local dev.
-- Idempotent — re-running does not duplicate (upserts on email/firebase_id/user_platform_id).

INSERT INTO "users" ("id", "firebase_id", "email")
VALUES
  (gen_random_uuid()::text, 'seed-photographer-ahmad',  'seed.ahmad@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-nurul',  'seed.nurul@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-lim',    'seed.lim@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-siti',   'seed.siti@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-daniel', 'seed.daniel@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-farah',  'seed.farah@picsweep.test'),
  (gen_random_uuid()::text, 'seed-photographer-ravi',   'seed.ravi@picsweep.test')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "user_platforms" ("id", "user_id", "role")
SELECT gen_random_uuid()::text, u."id", 'PHOTOGRAPHER'::"user_role"
FROM "users" u
WHERE u."email" IN (
  'seed.ahmad@picsweep.test',
  'seed.nurul@picsweep.test',
  'seed.lim@picsweep.test',
  'seed.siti@picsweep.test',
  'seed.daniel@picsweep.test',
  'seed.farah@picsweep.test',
  'seed.ravi@picsweep.test'
)
ON CONFLICT ("user_id", "role") DO NOTHING;

INSERT INTO "photographer_profiles" ("id", "user_platform_id", "name", "bio", "company_name", "phone", "contact_no", "updated_at")
SELECT
  gen_random_uuid()::text,
  up."id",
  v."name",
  v."bio",
  v."company_name",
  v."contact_no",
  v."contact_no",
  CURRENT_TIMESTAMP
FROM (VALUES
  ('seed.ahmad@picsweep.test',  'Ahmad Faizal',   'Faizal Lens Studio',      'Specialist in cycling endurance events. 8 years shooting gran fondos across Malaysia.', '601212345601'),
  ('seed.nurul@picsweep.test',  'Nurul Aisyah',   'Aisyah Captures',         'Marathon and trail running photographer. Chasing runners since 2019.',                 '601212345602'),
  ('seed.lim@picsweep.test',    'Lim Wei Chen',   'WC Motorsport Media',     'Motorsport action photographer covering Sepang circuits and rally events.',            '601212345603'),
  ('seed.siti@picsweep.test',   'Siti Rahmah',    'Rahmah Visuals',          'Swimming and triathlon event coverage with fast same-day galleries.',                  '601212345604'),
  ('seed.daniel@picsweep.test', 'Daniel Tan',     'Daniel Tan Photography',  'Community fun runs and charity rides. Every finisher deserves a great photo.',         '601212345605'),
  ('seed.farah@picsweep.test',  'Farah Zulkifli', 'Farah Frames',            'Sports and lifestyle photographer based in Penang. Available for island-wide events.', '601212345606'),
  ('seed.ravi@picsweep.test',   'Ravi Kumar',     'Ravi Speed Shots',        'High-speed photography for motorsport and cycling sprints. KL based, nationwide.',     '601212345607')
) AS v("email", "name", "company_name", "bio", "contact_no")
JOIN "users" u ON u."email" = v."email"
JOIN "user_platforms" up ON up."user_id" = u."id" AND up."role" = 'PHOTOGRAPHER'
ON CONFLICT ("user_platform_id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "bio" = EXCLUDED."bio",
  "company_name" = EXCLUDED."company_name",
  "contact_no" = EXCLUDED."contact_no",
  "updated_at" = CURRENT_TIMESTAMP;
