-- Upgrade schema for Coach Working Days, Bank Account, Exception Requests, and Payouts

-- 1. Coach Profile: bank account & working schedule
ALTER TABLE coach_profiles 
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '[]'::jsonb;

-- 2. Coach Availability: approval status for exception / out-of-shift slots
ALTER TABLE coach_availability 
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS is_exception BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exception_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3. Coach Payouts table
CREATE TABLE IF NOT EXISTS coach_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_name VARCHAR(150),
  month VARCHAR(7) NOT NULL, -- e.g. '2026-11'
  group_session_count INT NOT NULL DEFAULT 0,
  pt_session_count INT NOT NULL DEFAULT 0,
  total_sessions INT NOT NULL DEFAULT 0,
  rate_per_session DECIMAL(12, 2) NOT NULL DEFAULT 200000,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- 'UNPAID' | 'PAID'
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_name VARCHAR(150),
  payment_note VARCHAR(255),
  paid_at TIMESTAMPTZ,
  paid_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_by_name VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_coach_payouts_coach_month UNIQUE(coach_id, month)
);

CREATE INDEX IF NOT EXISTS idx_coach_payouts_month ON coach_payouts(month);
CREATE INDEX IF NOT EXISTS idx_coach_payouts_coach_id ON coach_payouts(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_availability_approval ON coach_availability(approval_status);
