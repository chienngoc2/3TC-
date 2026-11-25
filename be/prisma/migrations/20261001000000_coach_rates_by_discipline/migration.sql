-- Legacy rates remain nullable and are used only when no discipline rate exists.
ALTER TABLE "coach_rates" ADD COLUMN IF NOT EXISTS "discipline_id" UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_coach_rates_discipline'
  ) THEN
    ALTER TABLE "coach_rates" ADD CONSTRAINT "fk_coach_rates_discipline"
      FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_coach_rates_coach_discipline"
  ON "coach_rates"("coach_id", "discipline_id");

-- The range column is installed by the manual V5 constraints script.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'coach_rates' AND column_name = 'rate_range'
  ) THEN
    ALTER TABLE coach_rates DROP CONSTRAINT IF EXISTS no_coach_rate_overlap;
    ALTER TABLE coach_rates DROP CONSTRAINT IF EXISTS no_legacy_coach_rate_overlap;
    ALTER TABLE coach_rates ADD CONSTRAINT no_coach_rate_overlap
      EXCLUDE USING gist (coach_id WITH =, discipline_id WITH =, rate_range WITH &&)
      WHERE (discipline_id IS NOT NULL);
    ALTER TABLE coach_rates ADD CONSTRAINT no_legacy_coach_rate_overlap
      EXCLUDE USING gist (coach_id WITH =, rate_range WITH &&)
      WHERE (discipline_id IS NULL);
  END IF;
END $$;
