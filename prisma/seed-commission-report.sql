-- Seed: bulk PAID CASH payments + commission charges across the 7 seed photographers, to see the
-- admin Commission Report with a lot of data.
-- Needs prisma/seed-photographers.sql run first. Re-runnable: the cleanup block below wipes every
-- row this file creates (and nothing else) before inserting again. Run the cleanup block alone to
-- remove the demo data.
--
-- Everything is tagged: orders by email 'seed.report+<n>@picsweep.test', events by title '[Seed] ...',
-- plans/values by name 'Seed ... (report demo)', CASH options by the seed photographers' emails.

-- ## Cleanup (FK order) ##
DELETE FROM "commission_charges" WHERE "payment_id" IN (
  SELECT p."id" FROM "merchant_payments" p JOIN "orders" o ON o."id" = p."order_id"
  WHERE o."email" LIKE 'seed.report+%@picsweep.test'
);
DELETE FROM "merchant_payments" WHERE "order_id" IN (
  SELECT "id" FROM "orders" WHERE "email" LIKE 'seed.report+%@picsweep.test'
);
DELETE FROM "orders" WHERE "email" LIKE 'seed.report+%@picsweep.test';
DELETE FROM "events" WHERE "title" LIKE '[Seed] %';
DELETE FROM "merchant_payment_platform_options" WHERE "provider" = 'CASH' AND "user_platform_id" IN (
  SELECT up."id" FROM "user_platforms" up JOIN "users" u ON u."id" = up."user_id"
  WHERE u."email" LIKE 'seed.%@picsweep.test'
);
DELETE FROM "commission_plans" WHERE "name" LIKE 'Seed % (report demo)';
DELETE FROM "percentage_commission_per_transactions" WHERE "name" LIKE 'Seed % (report demo)';
DELETE FROM "amount_commission_per_transactions" WHERE "name" LIKE 'Seed % (report demo)';

-- ## Insert ##
DO $$
DECLARE
  v_pct_value_id text := gen_random_uuid()::text;
  v_amt_value_id text := gen_random_uuid()::text;
  v_pct_plan_id  text := gen_random_uuid()::text;
  v_amt_plan_id  text := gen_random_uuid()::text;
  ph             record;
  v_option_id    text;
  v_event_ids    text[];
  v_event_id     text;
  v_photo_ids    text[];
  v_photo_id     text;
  v_order_id     text;
  v_payment_id   text;
  v_charge_id    text;
  v_total        numeric;
  v_price        numeric;
  v_commission   numeric;
  v_at           timestamp(3);
  v_is_pct       boolean;
  v_is_broken    boolean;
  v_order_no     int := 0;
  i              int;
  e              int;
  p              int;
  k              int;
BEGIN
  -- Plans: not default, so the real default plans are untouched.
  INSERT INTO "percentage_commission_per_transactions" ("id", "name", "percentage_value")
  VALUES (v_pct_value_id, 'Seed 10% (report demo)', 10);
  INSERT INTO "amount_commission_per_transactions" ("id", "name", "amount_value")
  VALUES (v_amt_value_id, 'Seed RM1 flat (report demo)', 1.00);

  INSERT INTO "commission_plans" ("id", "name", "type", "is_default", "is_active", "updated_at", "percentage_commission_per_transaction_id")
  VALUES (v_pct_plan_id, 'Seed 10% (report demo)', 'PERCENTAGE_PER_TRANSACTION', false, true, CURRENT_TIMESTAMP, v_pct_value_id);
  INSERT INTO "commission_plans" ("id", "name", "type", "is_default", "is_active", "updated_at", "amount_commission_per_transaction_id")
  VALUES (v_amt_plan_id, 'Seed RM1 flat (report demo)', 'AMOUNT_PER_TRANSACTION', false, true, CURRENT_TIMESTAMP, v_amt_value_id);

  FOR ph IN
    SELECT pp."id" AS profile_id, up."id" AS user_platform_id,
           row_number() OVER (ORDER BY u."email")::int AS n
    FROM "users" u
    JOIN "user_platforms" up ON up."user_id" = u."id" AND up."role" = 'PHOTOGRAPHER'
    JOIN "photographer_profiles" pp ON pp."user_platform_id" = up."id"
    WHERE u."email" LIKE 'seed.%@picsweep.test'
    ORDER BY u."email"
  LOOP
    v_is_pct := ph.n % 2 = 1;

    v_option_id := gen_random_uuid()::text;
    INSERT INTO "merchant_payment_platform_options"
      ("id", "user_platform_id", "provider", "approval_status", "is_impose_commission", "updated_at")
    VALUES (v_option_id, ph.user_platform_id, 'CASH', 'APPROVED', true, CURRENT_TIMESTAMP);
    INSERT INTO "merchant_cash_payment_platform_options" ("id", "payment_platform_option_id", "updated_at")
    VALUES (gen_random_uuid()::text, v_option_id, CURRENT_TIMESTAMP);

    -- 2 events x 6 uploaded photos each.
    v_event_ids := ARRAY[]::text[];
    FOR e IN 1..2 LOOP
      v_event_id := gen_random_uuid()::text;
      v_event_ids := v_event_ids || v_event_id;
      INSERT INTO "events"
        ("id", "photographer_id", "title", "category", "event_start_date", "event_end_date", "is_published", "updated_at")
      VALUES (
        v_event_id, ph.profile_id, '[Seed] Report demo ' || ph.n || '-' || e,
        (ARRAY['CYCLING','RUNNING','SWIMMING','TRIATHLON','MOTORSPORT','OTHER'])[1 + (ph.n + e) % 6]::"event_category",
        now() - interval '100 days', now() - interval '99 days', true, CURRENT_TIMESTAMP
      );
      FOR p IN 1..6 LOOP
        INSERT INTO "photos" ("id", "event_id", "key", "original_name", "mime_type", "status", "updated_at")
        VALUES (gen_random_uuid()::text, v_event_id, 'seed-report/' || gen_random_uuid()::text,
                'seed-' || ph.n || '-' || e || '-' || p || '.jpg', 'image/jpeg', 'UPLOADED', CURRENT_TIMESTAMP);
      END LOOP;
    END LOOP;

    -- 10-30 paid orders per photographer over the last 90 days.
    FOR i IN 1..(10 + floor(random() * 21)::int) LOOP
      v_order_no := v_order_no + 1;
      v_event_id := v_event_ids[1 + floor(random() * 2)::int];
      v_at := (now() - random() * interval '90 days')::timestamp(3);
      v_order_id := gen_random_uuid()::text;

      INSERT INTO "orders"
        ("id", "event_id", "email", "country_code", "phone", "subtotal", "discount_amount", "total", "price_breakdown", "status", "created_at")
      VALUES (v_order_id, v_event_id, 'seed.report+' || v_order_no || '@picsweep.test', '60', '123456789',
              0, 0, 0, '{}'::jsonb, 'DELIVERED', v_at);

      -- 1-4 distinct photos at RM 10/15/20/25 (whole ringgit, multiples of 5, so % math is exact).
      k := 1 + floor(random() * 4)::int;
      v_total := 0;
      FOR v_photo_id IN
        SELECT "id" FROM "photos" WHERE "event_id" = v_event_id ORDER BY random() LIMIT k
      LOOP
        v_price := (ARRAY[10, 15, 20, 25])[1 + floor(random() * 4)::int];
        v_total := v_total + v_price;
        INSERT INTO "order_items" ("id", "order_id", "photo_id", "format_label", "price")
        VALUES (gen_random_uuid()::text, v_order_id, v_photo_id, 'Digital', v_price);
      END LOOP;
      UPDATE "orders"
      SET "subtotal" = v_total, "total" = v_total,
          "price_breakdown" = jsonb_build_object('subtotal', v_total, 'discountAmount', 0, 'total', v_total)
      WHERE "id" = v_order_id;

      v_payment_id := gen_random_uuid()::text;
      INSERT INTO "merchant_payments"
        ("id", "order_id", "merchant_payment_platform_option_id", "provider", "amount", "status", "created_at", "updated_at")
      VALUES (v_payment_id, v_order_id, v_option_id, 'CASH', v_total, 'PAID', v_at + interval '5 minutes', CURRENT_TIMESTAMP);

      -- Deliberately broken: photographer 3's first 3 orders get a stored commission RM 0.50 off,
      -- so the red "does not reconcile" state shows. Delete this condition for all-green data.
      v_is_broken := ph.n = 3 AND i <= 3;

      -- ~10% of payments carry no charge (commission not imposed), except the broken ones.
      IF v_is_broken OR random() >= 0.10 THEN
        v_charge_id := gen_random_uuid()::text;
        v_commission := CASE WHEN v_is_pct THEN round(v_total * 10 / 100, 2) ELSE 1.00 END;
        IF v_is_broken THEN
          v_commission := v_commission + 0.50;
        END IF;

        INSERT INTO "commission_charges"
          ("id", "payment_id", "commission_plan_id", "commission_type", "original_payment_amount",
           "commission_base_amount", "commission_amount", "commission_imposed_at")
        VALUES (v_charge_id, v_payment_id,
                CASE WHEN v_is_pct THEN v_pct_plan_id ELSE v_amt_plan_id END,
                CASE WHEN v_is_pct THEN 'PERCENTAGE_PER_TRANSACTION' ELSE 'AMOUNT_PER_TRANSACTION' END::"commission_type",
                v_total, v_total, v_commission, v_at + interval '5 minutes');

        IF v_is_pct THEN
          INSERT INTO "commission_charge_percentage_per_transactions"
            ("id", "commission_charge_id", "percentage_rate_applied", "transaction_amount", "commission_amount")
          VALUES (gen_random_uuid()::text, v_charge_id, 10, v_total, v_commission);
        ELSE
          INSERT INTO "commission_charge_amount_per_transactions"
            ("id", "commission_charge_id", "flat_amount_applied", "transaction_amount", "commission_amount")
          VALUES (gen_random_uuid()::text, v_charge_id, 1.00, v_total, v_commission);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;
