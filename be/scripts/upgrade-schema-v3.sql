ALTER TABLE cancellation_requests 
ADD COLUMN IF NOT EXISTS substitution_status VARCHAR(50) DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS substitute_coach_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS substitution_note VARCHAR(500),
ADD COLUMN IF NOT EXISTS substitution_responded_at TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS substitution_declined_reason VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_substitute ON cancellation_requests(substitute_coach_id, substitution_status);
