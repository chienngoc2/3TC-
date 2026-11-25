-- Add new columns for Plan Curriculum, Weekly Schedule Preview, Recommended Roadmap, Two-Sport Rule
ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS curriculum_topics jsonb,
ADD COLUMN IF NOT EXISTS weekly_schedule_preview jsonb,
ADD COLUMN IF NOT EXISTS recommended_roadmap jsonb,
ADD COLUMN IF NOT EXISTS two_sport_rule text;

-- Add substitute_coach_id to cancellation_requests for manager assigning substitute coach
ALTER TABLE cancellation_requests
ADD COLUMN IF NOT EXISTS substitute_coach_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cancellation_requests_substitute_coach'
  ) THEN
    ALTER TABLE cancellation_requests
    ADD CONSTRAINT fk_cancellation_requests_substitute_coach
    FOREIGN KEY (substitute_coach_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
