```sql
-- ============================================================================
-- SPORTS CENTER MANAGEMENT SYSTEM - PRODUCTION DDL (POSTGRESQL 15+)
-- Standard: Full Named Constraints & Complete Query/FK Indexes
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ENUM TYPES
CREATE TYPE user_role AS ENUM ('MANAGER', 'COACH', 'RECEPTIONIST', 'MEMBER');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'EXPIRED', 'FROZEN');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD');
CREATE TYPE invoice_status AS ENUM ('PAID', 'PENDING', 'REFUNDED', 'CANCELLED');

-- 3. CORE SCHEMAS & NAMED CONSTRAINTS

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role user_role NOT NULL DEFAULT 'MEMBER',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_phone UNIQUE (phone)
);

CREATE TABLE member_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    height_cm DECIMAL(5, 2),
    weight_kg DECIMAL(5, 2),
    bmi DECIMAL(4, 2),
    body_fat_pct DECIMAL(4, 2),
    fitness_goals TEXT,
    medical_history TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_member_profiles_user_id UNIQUE (user_id),
    CONSTRAINT fk_member_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_member_height CHECK (height_cm IS NULL OR height_cm > 0),
    CONSTRAINT chk_member_weight CHECK (weight_kg IS NULL OR weight_kg > 0),
    CONSTRAINT chk_member_bmi CHECK (bmi IS NULL OR bmi > 0),
    CONSTRAINT chk_member_body_fat CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100))
);

CREATE TABLE coach_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    specialties TEXT,
    bio TEXT,
    certificate_urls TEXT[] NOT NULL DEFAULT '{}',
    years_experience INT DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coach_profiles_user_id UNIQUE (user_id),
    CONSTRAINT fk_coach_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_coach_experience CHECK (years_experience IS NULL OR years_experience >= 0)
);

CREATE TABLE membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    duration_days INT NOT NULL,
    session_quota INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_plan_price CHECK (price >= 0),
    CONSTRAINT chk_plan_duration CHECK (duration_days > 0),
    CONSTRAINT chk_plan_session_quota CHECK (session_quota IS NULL OR session_quota > 0)
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remaining_sessions INT,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE RESTRICT,
    CONSTRAINT chk_subscription_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_subscription_remaining_sessions CHECK (remaining_sessions IS NULL OR remaining_sessions >= 0)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_code VARCHAR(50) NOT NULL,
    subscription_id UUID NOT NULL,
    issuer_id UUID NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    status invoice_status NOT NULL DEFAULT 'PAID',
    transaction_ref VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoices_invoice_code UNIQUE (invoice_code),
    CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_issuer FOREIGN KEY (issuer_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_invoice_amount CHECK (amount >= 0)
);

CREATE TABLE disciplines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    CONSTRAINT uq_disciplines_name UNIQUE (name)
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    location_note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_room_capacity CHECK (capacity > 0)
);

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discipline_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    CONSTRAINT fk_classes_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE RESTRICT
);

CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    room_id UUID NOT NULL,
    coach_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL,
    current_enrolled INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED,
    CONSTRAINT fk_schedules_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedules_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT fk_schedules_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_schedule_time_validity CHECK (end_time > start_time),
    CONSTRAINT chk_schedule_capacity CHECK (capacity > 0),
    CONSTRAINT chk_schedule_enrolled_bounds CHECK (current_enrolled >= 0 AND current_enrolled <= capacity),
    CONSTRAINT no_room_schedule_overlap EXCLUDE USING gist (room_id WITH =, time_range WITH &&),
    CONSTRAINT no_coach_schedule_overlap EXCLUDE USING gist (coach_id WITH =, time_range WITH &&)
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL,
    member_id UUID NOT NULL,
    status booking_status NOT NULL DEFAULT 'CONFIRMED',
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_bookings_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_member FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID,
    member_id UUID NOT NULL,
    verified_by_id UUID,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status attendance_status NOT NULL DEFAULT 'PRESENT',
    checkin_type VARCHAR(20) NOT NULL DEFAULT 'CLASS_SESSION',
    notes TEXT,
    CONSTRAINT uq_attendances_booking_id UNIQUE (booking_id),
    CONSTRAINT fk_attendances_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_attendances_member FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendances_verifier FOREIGN KEY (verified_by_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_attendance_checkin_type CHECK (checkin_type IN ('GATE_ENTRY', 'CLASS_SESSION')),
    CONSTRAINT chk_attendance_type_consistency CHECK (
        (checkin_type = 'CLASS_SESSION' AND booking_id IS NOT NULL) OR
        (checkin_type = 'GATE_ENTRY' AND booking_id IS NULL)
    )
);

CREATE TABLE workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL,
    coach_id UUID NOT NULL,
    title VARCHAR(150) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_workout_plans_member FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_plans_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE exercise_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    instructions TEXT NOT NULL,
    embedding VECTOR(1536)
);

CREATE TABLE workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    sets INT,
    reps INT,
    weight_kg DECIMAL(5, 2),
    rest_seconds INT,
    coach_feedback TEXT,
    order_index INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_workout_exercises_plan FOREIGN KEY (workout_plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_knowledge(id) ON DELETE RESTRICT,
    CONSTRAINT chk_workout_sets CHECK (sets IS NULL OR sets > 0),
    CONSTRAINT chk_workout_reps CHECK (reps IS NULL OR reps > 0),
    CONSTRAINT chk_workout_weight CHECK (weight_kg IS NULL OR weight_kg >= 0),
    CONSTRAINT chk_workout_rest CHECK (rest_seconds IS NULL OR rest_seconds >= 0)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    target_id UUID,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 4. FULL EXPLICIT INDEXES SPECIFICATIONS (20 RESTORED INDEXES)
-- ============================================================================

-- A. Subscriptions & Billing
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_issuer_id ON invoices(issuer_id);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- B. Classes & Facilities
CREATE INDEX idx_classes_discipline_id ON classes(discipline_id);
CREATE INDEX idx_schedules_class_id ON schedules(class_id);
CREATE INDEX idx_schedules_room_id ON schedules(room_id);
CREATE INDEX idx_schedules_coach_id ON schedules(coach_id);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);

-- C. Booking & Attendances
CREATE INDEX idx_bookings_schedule_id ON bookings(schedule_id);
CREATE INDEX idx_bookings_member_id ON bookings(member_id);
CREATE INDEX idx_attendances_member_id ON attendances(member_id);
CREATE INDEX idx_attendances_verified_by_id ON attendances(verified_by_id);
CREATE INDEX idx_attendances_check_in_time ON attendances(check_in_time);

-- D. Workouts & Training
CREATE INDEX idx_workout_plans_member_id ON workout_plans(member_id);
CREATE INDEX idx_workout_plans_coach_id ON workout_plans(coach_id);
CREATE INDEX idx_workout_exercises_plan_id ON workout_exercises(workout_plan_id);
CREATE INDEX idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);

-- E. Security & Audit Trail
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_target_entity_id ON audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- F. Advanced Business Partial Unique Index (Re-booking Support)
CREATE UNIQUE INDEX uq_active_class_booking 
    ON bookings (schedule_id, member_id) 
    WHERE status IN ('CONFIRMED', 'PENDING');

-- G. AI Cosine Distance Vector Index (pgvector)
CREATE INDEX idx_exercise_knowledge_embedding 
    ON exercise_knowledge 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
```