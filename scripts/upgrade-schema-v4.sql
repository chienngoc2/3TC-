-- Upgrade schema v4: Coach star ratings, rate per session, plan coach star ratings, subscription coach star ratings

ALTER TABLE coach_profiles 
  ADD COLUMN IF NOT EXISTS rating_stars INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS rate_per_session DECIMAL(12, 2) DEFAULT 300000;

CREATE INDEX IF NOT EXISTS idx_coach_profiles_rating_stars ON coach_profiles (rating_stars);

ALTER TABLE membership_plans 
  ADD COLUMN IF NOT EXISTS coach_rating_stars INTEGER DEFAULT 3;

ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS coach_rating_stars INTEGER DEFAULT 3;
