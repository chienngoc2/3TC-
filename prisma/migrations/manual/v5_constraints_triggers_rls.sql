-- =============================================================================
-- SPORTS CENTER V5 — MANUAL MIGRATION (Ngoài phạm vi Prisma Client)
-- File: prisma/migrations/manual/v5_constraints_triggers_rls.sql
--
-- Chạy file này SAU mỗi `npx prisma db push` hoặc `prisma migrate deploy`:
--   psql $DIRECT_URL -f prisma/migrations/manual/v5_constraints_triggers_rls.sql
--
-- Nội dung:
--   1. Extensions
--   2. Cột GENERATED ALWAYS (rate_range, shift_range, time_range)
--   3. Cột V5 bổ sung (is_emergency_cancelled, last_cancellation_reset_date nullable)
--   4. GiST Exclusion Constraints — PARTIAL (chỉ xét lịch OPEN/FULL)
--   5. Partial Unique Indexes (concurrency safety)
--   6. Triggers (cross-schedule conflict, DSS, sync discipline)
--   7. Stored Procedures (VIP purchase, PT add-on, Gate check-in)
--   8. Row Level Security (RLS) Policies
-- =============================================================================

BEGIN;
SET LOCAL search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CỘT GENERATED ALWAYS (Prisma không hỗ trợ GENERATED ALWAYS AS ... STORED)
--    Thêm an toàn (IF NOT EXISTS qua DO block) để migration idempotent
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- coach_rates.rate_range
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='coach_rates' AND column_name='rate_range'
    ) THEN
        ALTER TABLE coach_rates
            ADD COLUMN rate_range DATERANGE
            GENERATED ALWAYS AS (daterange(effective_from, effective_to, '[]')) STORED;
    END IF;

    -- staff_shifts.shift_range
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='staff_shifts' AND column_name='shift_range'
    ) THEN
        ALTER TABLE staff_shifts
            ADD COLUMN shift_range TSTZRANGE
            GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;
    END IF;

    -- schedules.time_range
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='schedules' AND column_name='time_range'
    ) THEN
        ALTER TABLE schedules
            ADD COLUMN time_range TSTZRANGE
            GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;
    END IF;

    -- coach_availability.time_range
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='coach_availability' AND column_name='time_range'
    ) THEN
        ALTER TABLE coach_availability
            ADD COLUMN time_range TSTZRANGE
            GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;
    END IF;

    -- equipment_reservations.time_range
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='equipment_reservations' AND column_name='time_range'
    ) THEN
        ALTER TABLE equipment_reservations
            ADD COLUMN time_range TSTZRANGE
            GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CỘT BỔ SUNG V5 (Prisma db push tạo cột nhưng không thêm default SQL chuẩn)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- coach_profiles.last_cancellation_reset_date: Prisma cho phép NULL (đúng),
    -- SQL V5 cũ đặt NOT NULL DEFAULT CURRENT_DATE — giữ nullable để đồng bộ Prisma.
    -- Không cần thay đổi vì db push đã tạo đúng.

    -- coach_availability.is_emergency_cancelled (V5 mới)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='coach_availability' AND column_name='is_emergency_cancelled'
    ) THEN
        ALTER TABLE coach_availability
            ADD COLUMN is_emergency_cancelled BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN coach_availability.is_emergency_cancelled IS
            'TRUE khi HLV hủy khẩn cấp ca này. Slot bị đặt false cho is_booked nhưng không thể nhận booking mới.';
    END IF;

    -- exercise_knowledge.embedding (pgvector)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='exercise_knowledge' AND column_name='embedding'
    ) THEN
        ALTER TABLE exercise_knowledge
            ADD COLUMN embedding vector(1536);
        COMMENT ON COLUMN exercise_knowledge.embedding IS
            'Vector embedding 1536 chiều cho RAG (OpenAI text-embedding-3-small / Gemini text-embedding-004).';
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GiST EXCLUSION CONSTRAINTS — PARTIAL
--    Chỉ áp dụng cho lịch có status OPEN hoặc FULL.
--    Lịch CANCELLED_BY_COACH/COMPLETED không còn "chiếm" khung giờ → phòng/HLV
--    có thể tái sử dụng mà không cần xóa record (bảo toàn audit trail với RESTRICT FK).
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1. Xóa constraint cũ (full exclusion) nếu tồn tại
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS no_room_schedule_overlap;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS no_coach_schedule_overlap;

-- 4.2. Partial exclusion được PostgreSQL kiểm tra cả khi transaction chạy đồng thời.
ALTER TABLE schedules ADD CONSTRAINT no_room_schedule_overlap
    EXCLUDE USING gist (room_id WITH =, time_range WITH &&)
    WHERE (status IN ('OPEN', 'FULL'));
ALTER TABLE schedules ADD CONSTRAINT no_coach_schedule_overlap
    EXCLUDE USING gist (coach_id WITH =, time_range WITH &&)
    WHERE (status IN ('OPEN', 'FULL'));

-- 4.3. Rates must not overlap for the same coach and discipline.
ALTER TABLE coach_rates DROP CONSTRAINT IF EXISTS no_coach_rate_overlap;
ALTER TABLE coach_rates DROP CONSTRAINT IF EXISTS no_legacy_coach_rate_overlap;
ALTER TABLE coach_rates
    ADD CONSTRAINT no_coach_rate_overlap
    EXCLUDE USING gist (coach_id WITH =, discipline_id WITH =, rate_range WITH &&)
    WHERE (discipline_id IS NOT NULL);
ALTER TABLE coach_rates
    ADD CONSTRAINT no_legacy_coach_rate_overlap
    EXCLUDE USING gist (coach_id WITH =, rate_range WITH &&)
    WHERE (discipline_id IS NULL);

-- 4.4. Exclusion trên staff_shifts
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS no_staff_shift_overlap;
ALTER TABLE staff_shifts
    ADD CONSTRAINT no_staff_shift_overlap
    EXCLUDE USING gist (staff_id WITH =, shift_range WITH &&);

-- 4.5. Exclusion trên equipment_reservations
ALTER TABLE equipment_reservations DROP CONSTRAINT IF EXISTS no_equipment_overlap;
ALTER TABLE equipment_reservations
    ADD CONSTRAINT no_equipment_overlap
    EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&);

-- 4.6. Exclusion trên coach_availability (full — slot cụ thể, không có status)
ALTER TABLE coach_availability DROP CONSTRAINT IF EXISTS no_coach_availability_overlap;
ALTER TABLE coach_availability
    ADD CONSTRAINT no_coach_availability_overlap
    EXCLUDE USING gist (coach_id WITH =, time_range WITH &&)
    WHERE (is_emergency_cancelled = FALSE);
-- Slot emergency-cancelled không còn "chiếm" thời gian → HLV có thể nhận slot mới.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PARTIAL UNIQUE INDEXES (Concurrency Safety)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1. Chống gán 1 tủ cho 2 người cùng lúc
CREATE UNIQUE INDEX IF NOT EXISTS uq_locker_single_active_assignment
    ON locker_assignments (locker_id)
    WHERE returned_at IS NULL;

-- 5.2. Chống đặt trùng lớp nhóm đang active
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_booking
    ON bookings (schedule_id, member_id)
    WHERE status IN ('CONFIRMED', 'PENDING') AND booking_type = 'GROUP_CLASS';

-- 5.3. Chống đặt trùng slot PT đang active
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pt_booking
    ON bookings (coach_availability_id, member_id)
    WHERE status IN ('CONFIRMED', 'PENDING') AND booking_type = 'PERSONAL_TRAINING';

-- 5.4. Chống lạm dụng Free Trial (mỗi môn chỉ 1 lần trong đời)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_single_trial_per_discipline
    ON user_subscriptions (user_id, discipline_id)
    WHERE discipline_id IS NOT NULL AND package_tier = 'TRIAL';

-- 5.5. Coach-availability: chỉ tìm slot thực sự rảnh
CREATE INDEX IF NOT EXISTS idx_coach_avail_free
    ON coach_availability (coach_id, start_time)
    WHERE is_booked = FALSE AND is_emergency_cancelled = FALSE;

-- 5.6. AI Vector Index (RAG cosine distance)
CREATE INDEX IF NOT EXISTS idx_exercise_knowledge_embedding
    ON exercise_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.1. Exclusion constraints thay thế trigger EXISTS không an toàn khi concurrent.
DROP TRIGGER IF EXISTS trg_prevent_active_schedule_overlap ON schedules;
DROP FUNCTION IF EXISTS fn_prevent_active_schedule_overlap();

-- OPEN/FULL được suy ra từ current_enrolled; service chịu trách nhiệm tăng/giảm sĩ số.
-- Không tăng/giảm sĩ số từ booking trigger để tránh đếm hai lần.
CREATE OR REPLACE FUNCTION fn_sync_schedule_capacity_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('OPEN', 'FULL') THEN
        IF NEW.current_enrolled >= NEW.capacity THEN
            NEW.status := 'FULL';
        ELSE
            NEW.status := 'OPEN';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_schedule_capacity_status ON schedules;
CREATE TRIGGER trg_sync_schedule_capacity_status
    BEFORE INSERT OR UPDATE OF current_enrolled, capacity, status ON schedules
    FOR EACH ROW EXECUTE FUNCTION fn_sync_schedule_capacity_status();

-- Đồng bộ các lịch active đã tồn tại; không sửa trạng thái lịch đã đóng.
UPDATE schedules SET status = CASE
    WHEN current_enrolled >= capacity THEN 'FULL'::schedule_status
    ELSE 'OPEN'::schedule_status END
WHERE status IN ('OPEN', 'FULL')
  AND status::text <> CASE WHEN current_enrolled >= capacity THEN 'FULL' ELSE 'OPEN' END;

-- 6.2. Kiểm tra HLV chéo giữa schedules và coach_availability với Advisory Lock
CREATE OR REPLACE FUNCTION fn_prevent_coach_cross_schedule_conflict()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id UUID;
    v_time_range TSTZRANGE;
BEGIN
    v_coach_id   := NEW.coach_id;
    v_time_range := tstzrange(NEW.start_time, NEW.end_time, '[)');

    PERFORM pg_advisory_xact_lock(hashtext(v_coach_id::text));

    IF (TG_TABLE_NAME = 'coach_availability') THEN
        IF NEW.is_emergency_cancelled = TRUE THEN
            RETURN NEW; -- Slot emergency-cancelled không cần kiểm tra chồng
        END IF;
        IF EXISTS (
            SELECT 1 FROM schedules
            WHERE coach_id = v_coach_id
              AND status IN ('OPEN', 'FULL')
              AND time_range && v_time_range
        ) THEN
            RAISE EXCEPTION 'CONFLICT_SCHEDULE: HLV (ID: %) đã có lớp nhóm active trong khung giờ này.', v_coach_id;
        END IF;
    END IF;

    IF (TG_TABLE_NAME = 'schedules') THEN
        IF NEW.status NOT IN ('OPEN', 'FULL') THEN
            RETURN NEW;
        END IF;
        IF EXISTS (
            SELECT 1 FROM coach_availability
            WHERE coach_id = v_coach_id
              AND is_emergency_cancelled = FALSE
              AND time_range && v_time_range
        ) THEN
            RAISE EXCEPTION 'CONFLICT_SCHEDULE: HLV (ID: %) đã có PT slot trong khung giờ này.', v_coach_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_coach_avail_overlap ON coach_availability;
CREATE TRIGGER trg_check_coach_avail_overlap
    BEFORE INSERT OR UPDATE OF start_time, end_time, coach_id, is_emergency_cancelled ON coach_availability
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_coach_cross_schedule_conflict();

DROP TRIGGER IF EXISTS trg_check_schedule_coach_overlap ON schedules;
CREATE TRIGGER trg_check_schedule_coach_overlap
    BEFORE INSERT OR UPDATE OF start_time, end_time, coach_id, status ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_coach_cross_schedule_conflict();

-- 6.3. Tự động sync discipline_id vào bookings từ schedule (GROUP_CLASS)
CREATE OR REPLACE FUNCTION fn_sync_booking_discipline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_type = 'GROUP_CLASS' AND NEW.schedule_id IS NOT NULL THEN
        SELECT c.discipline_id INTO NEW.discipline_id
        FROM schedules s
        JOIN classes c ON c.id = s.class_id
        WHERE s.id = NEW.schedule_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_discipline ON bookings;
CREATE TRIGGER trg_sync_booking_discipline
    BEFORE INSERT OR UPDATE OF schedule_id, booking_type ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_booking_discipline();

-- 6.4. Validate cấu hình gói: Chặn GYM tạo GROUP_CLASS
CREATE OR REPLACE FUNCTION fn_validate_plan_training_mode()
RETURNS TRIGGER AS $$
DECLARE
    v_discipline_code VARCHAR;
BEGIN
    IF NEW.discipline_id IS NOT NULL THEN
        SELECT code INTO v_discipline_code FROM disciplines WHERE id = NEW.discipline_id;
        IF v_discipline_code = 'GYM' AND NEW.training_mode = 'GROUP_CLASS' THEN
            RAISE EXCEPTION 'INVALID_PLAN_CONFIG: Discipline GYM không hỗ trợ GROUP_CLASS.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_plan_training_mode ON membership_plans;
CREATE TRIGGER trg_validate_plan_training_mode
    BEFORE INSERT OR UPDATE ON membership_plans
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_plan_training_mode();

-- 6.5. Sync discipline_id và package_tier từ plan vào user_subscriptions
CREATE OR REPLACE FUNCTION fn_sync_subscription_discipline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.plan_id IS NOT NULL THEN
        SELECT discipline_id, package_tier
        INTO NEW.discipline_id, NEW.package_tier
        FROM membership_plans WHERE id = NEW.plan_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_discipline ON user_subscriptions;
CREATE TRIGGER trg_sync_subscription_discipline
    BEFORE INSERT OR UPDATE OF plan_id ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_subscription_discipline();

-- 6.6. DSS: Đếm vi phạm & ghi nhận kỷ luật khi booking bị hủy do HLV
CREATE OR REPLACE FUNCTION fn_track_coach_emergency_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id         UUID;
    v_monthly_count    INT;
    v_suggested_action VARCHAR(50);
    v_suggested_pct    DECIMAL(5, 2) := 0;
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED'
       AND NEW.cancelled_by = 'COACH' AND NEW.is_emergency_cancellation = TRUE THEN

        IF NEW.booking_type = 'PERSONAL_TRAINING' THEN
            SELECT coach_id INTO v_coach_id
            FROM coach_availability WHERE id = NEW.coach_availability_id;
        ELSE
            SELECT coach_id INTO v_coach_id
            FROM schedules WHERE id = NEW.schedule_id;

            -- Chống ghi trùng phạt cho lớp nhóm (nhiều học viên cùng bị hủy 1 ca)
            IF EXISTS (
                SELECT 1 FROM coach_penalties cp
                JOIN bookings b ON cp.booking_id = b.id
                WHERE b.schedule_id = NEW.schedule_id
                  AND cp.coach_id = v_coach_id
                  AND cp.applied_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
            ) THEN
                RETURN NEW;
            END IF;
        END IF;

        IF v_coach_id IS NOT NULL THEN
            UPDATE coach_profiles
            SET emergency_cancellation_count       = emergency_cancellation_count + 1,
                monthly_emergency_cancellations    = monthly_emergency_cancellations + 1,
                updated_at                         = NOW()
            WHERE user_id = v_coach_id
            RETURNING monthly_emergency_cancellations INTO v_monthly_count;

            IF v_monthly_count <= 1 THEN
                v_suggested_action := 'NONE';       v_suggested_pct := 0;
            ELSIF v_monthly_count = 2 THEN
                v_suggested_action := 'WARNING';    v_suggested_pct := 0;
            ELSIF v_monthly_count >= 5 THEN
                v_suggested_action := 'TEMP_SUSPEND'; v_suggested_pct := 20.00;
            ELSE
                v_suggested_action := 'SUGGEST_RATE_REDUCTION_15PCT'; v_suggested_pct := 15.00;
            END IF;

            INSERT INTO coach_penalties (
                coach_id, booking_id, penalty_type, applied_month,
                suggested_action, suggested_rate_reduction_pct, notes
            ) VALUES (
                v_coach_id, NEW.id, 'EMERGENCY_CANCELLATION',
                TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
                v_suggested_action, v_suggested_pct,
                'Tự động ghi nhận vi phạm ca hủy đột xuất'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_track_coach_cancellation ON bookings;
CREATE TRIGGER trg_track_coach_cancellation
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION fn_track_coach_emergency_cancellation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STORED PROCEDURES
-- ─────────────────────────────────────────────────────────────────────────────

-- 7.1. Mua Gói VIP (giá động: base + 12 * coach_rate)
CREATE OR REPLACE PROCEDURE sp_purchase_vip_subscription(
    p_user_id         UUID,
    p_plan_id         UUID,
    p_coach_id        UUID,
    p_issuer_id       UUID,
    p_payment_method  payment_method,
    OUT p_subscription_id UUID,
    OUT p_invoice_id      UUID,
    OUT p_total_amount    DECIMAL(12,2)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_plan         RECORD;
    v_coach_rate   DECIMAL(12,2);
    v_base_amount  DECIMAL(12,2);
    v_pt_amount    DECIMAL(12,2);
    v_invoice_code VARCHAR(50);
BEGIN
    SELECT * INTO v_plan FROM membership_plans WHERE id = p_plan_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND_OR_INACTIVE'; END IF;

    SELECT rate_per_session INTO v_coach_rate
    FROM coach_rates
    WHERE coach_id = p_coach_id
      AND (discipline_id = v_plan.discipline_id OR discipline_id IS NULL)
      AND CURRENT_DATE <@ rate_range
    ORDER BY (discipline_id IS NOT NULL) DESC, effective_from DESC
    LIMIT 1;
    IF v_coach_rate IS NULL THEN RAISE EXCEPTION 'COACH_RATE_NOT_DEFINED'; END IF;

    v_base_amount  := v_plan.price;
    v_pt_amount    := COALESCE(v_plan.pt_session_quota, 12) * v_coach_rate;
    p_total_amount := v_base_amount + v_pt_amount;

    INSERT INTO user_subscriptions (
        user_id, plan_id, discipline_id, assigned_coach_id,
        start_date, end_date,
        remaining_group_sessions, remaining_pt_sessions,
        has_unlimited_gym_access, status
    ) VALUES (
        p_user_id, p_plan_id, v_plan.discipline_id, p_coach_id,
        CURRENT_DATE, CURRENT_DATE + v_plan.duration_days,
        v_plan.group_session_quota, COALESCE(v_plan.pt_session_quota, 12),
        v_plan.unlimited_gym_entry, 'ACTIVE'
    ) RETURNING id INTO p_subscription_id;

    v_invoice_code := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);

    INSERT INTO invoices (
        invoice_code, subscription_id, issuer_id, amount,
        base_amount, pt_amount, payment_method, status, type
    ) VALUES (
        v_invoice_code, p_subscription_id, p_issuer_id, p_total_amount,
        v_base_amount, v_pt_amount, p_payment_method, 'PAID', 'SUBSCRIPTION_NEW'
    ) RETURNING id INTO p_invoice_id;
END;
$$;

-- 7.2. Mua thêm giờ PT lẻ (Add-on Top-up)
CREATE OR REPLACE PROCEDURE sp_purchase_pt_addon(
    p_subscription_id UUID,
    p_addon_sessions  INT,
    p_issuer_id       UUID,
    p_payment_method  payment_method,
    OUT p_invoice_id  UUID,
    OUT p_amount      DECIMAL(12,2)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_sub          RECORD;
    v_coach_rate   DECIMAL(12,2);
    v_invoice_code VARCHAR(50);
BEGIN
    SELECT * INTO v_sub FROM user_subscriptions WHERE id = p_subscription_id AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_ACTIVE_OR_EXPIRED'; END IF;
    IF v_sub.assigned_coach_id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_HAS_NO_ASSIGNED_COACH'; END IF;

    SELECT rate_per_session INTO v_coach_rate
    FROM coach_rates
    WHERE coach_id = v_sub.assigned_coach_id
      AND (discipline_id = v_sub.discipline_id OR discipline_id IS NULL)
      AND CURRENT_DATE <@ rate_range
    ORDER BY (discipline_id IS NOT NULL) DESC, effective_from DESC
    LIMIT 1;
    IF v_coach_rate IS NULL THEN RAISE EXCEPTION 'COACH_RATE_NOT_DEFINED'; END IF;

    p_amount       := p_addon_sessions * v_coach_rate;
    v_invoice_code := 'ADDON-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);

    INSERT INTO invoices (
        invoice_code, subscription_id, issuer_id, amount,
        base_amount, pt_amount, payment_method, status, type
    ) VALUES (
        v_invoice_code, p_subscription_id, p_issuer_id, p_amount,
        0, p_amount, p_payment_method, 'PAID', 'PT_ADDON'
    ) RETURNING id INTO p_invoice_id;

    UPDATE user_subscriptions
    SET remaining_pt_sessions = remaining_pt_sessions + p_addon_sessions
    WHERE id = p_subscription_id;
END;
$$;

-- 7.3. Gate Check-in Tự Động (Xác thực quyền vào + Cấp tủ đồ + Khăn tập)
CREATE OR REPLACE PROCEDURE sp_gate_checkin_with_amenities(
    p_user_id                    UUID,
    p_verified_by_id             UUID,
    p_preferred_zone             VARCHAR,
    -- OUT params phải đứng trước param có DEFAULT (PostgreSQL rule)
    OUT p_attendance_id          UUID,
    OUT p_assigned_locker_number VARCHAR,
    p_towel_issued               BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_active_sub RECORD;
    v_locker     RECORD;
BEGIN
    -- Điều kiện 1: Có gói còn hạn với quota hoặc unlimited
    -- Điều kiện 2: Hôm nay có booking CONFIRMED (đã dùng buổi cuối nhưng vẫn có ca tập hợp lệ)
    SELECT * INTO v_active_sub
    FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status = 'ACTIVE'
      AND end_date >= CURRENT_DATE
      AND (
          has_unlimited_gym_access = TRUE
          OR remaining_group_sessions > 0
          OR remaining_pt_sessions > 0
          OR EXISTS (
              SELECT 1 FROM bookings b
              LEFT JOIN schedules s ON b.schedule_id = s.id
              LEFT JOIN coach_availability ca ON b.coach_availability_id = ca.id
              WHERE b.member_id = p_user_id
                AND b.status = 'CONFIRMED'
                AND (
                    (b.booking_type = 'GROUP_CLASS'
                     AND DATE(s.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = CURRENT_DATE)
                    OR
                    (b.booking_type = 'PERSONAL_TRAINING'
                     AND DATE(ca.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = CURRENT_DATE)
                )
          )
      )
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_VALID_ENTRY_PERMISSION: Không có gói còn hạn hoặc ca tập được xác nhận hôm nay.';
    END IF;

    INSERT INTO attendances (member_id, verified_by_id, checkin_type, towel_issued, status)
    VALUES (p_user_id, p_verified_by_id, 'GATE_ENTRY', p_towel_issued, 'PRESENT')
    RETURNING id INTO p_attendance_id;

    SELECT * INTO v_locker
    FROM lockers
    WHERE zone = p_preferred_zone
      AND status = 'AVAILABLE'
      AND is_active = TRUE
      AND id NOT IN (SELECT locker_id FROM locker_assignments WHERE returned_at IS NULL)
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        INSERT INTO locker_assignments (locker_id, user_id, assigned_by_id)
        VALUES (v_locker.id, p_user_id, p_verified_by_id);
        UPDATE lockers SET status = 'OCCUPIED' WHERE id = v_locker.id;
        p_assigned_locker_number := v_locker.locker_number;
    ELSE
        p_assigned_locker_number := 'NO_LOCKER_AVAILABLE';
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (Zero-Trust — Supabase JWT auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_rates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplines              ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_curriculum_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_availability       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_knowledge       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_specialties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_inbody_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lockers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE locker_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_penalties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events   ENABLE ROW LEVEL SECURITY;

-- Catalog tables: public read
DROP POLICY IF EXISTS "disciplines_read_all" ON disciplines;
CREATE POLICY "disciplines_read_all" ON disciplines FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "plans_read_all" ON membership_plans;
CREATE POLICY "plans_read_all" ON membership_plans FOR SELECT TO authenticated, anon
USING (is_active = TRUE OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'CENTER_MANAGER')));

DROP POLICY IF EXISTS "specialties_read_all" ON specialties;
CREATE POLICY "specialties_read_all" ON specialties FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "coach_specialties_read_all" ON coach_specialties;
CREATE POLICY "coach_specialties_read_all" ON coach_specialties FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "exercise_knowledge_read_all" ON exercise_knowledge;
CREATE POLICY "exercise_knowledge_read_all" ON exercise_knowledge FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rooms_read_all" ON rooms;
CREATE POLICY "rooms_read_all" ON rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "classes_read_all" ON classes;
CREATE POLICY "classes_read_all" ON classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "schedules_read_all" ON schedules;
CREATE POLICY "schedules_read_all" ON schedules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lockers_read_all" ON lockers;
CREATE POLICY "lockers_read_all" ON lockers FOR SELECT TO authenticated USING (true);

-- Users & Profiles
DROP POLICY IF EXISTS "users_read_self_or_staff" ON users;
CREATE POLICY "users_read_self_or_staff" ON users FOR SELECT TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST', 'COACH')));

DROP POLICY IF EXISTS "member_profiles_self_or_staff" ON member_profiles;
CREATE POLICY "member_profiles_self_or_staff" ON member_profiles FOR ALL TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST', 'COACH')));

DROP POLICY IF EXISTS "coach_profiles_read_all" ON coach_profiles;
CREATE POLICY "coach_profiles_read_all" ON coach_profiles FOR SELECT TO authenticated, anon USING (true);

-- Subscriptions & Invoices
DROP POLICY IF EXISTS "subscriptions_read_owner_or_staff" ON user_subscriptions;
CREATE POLICY "subscriptions_read_owner_or_staff" ON user_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "invoices_read_owner_or_staff" ON invoices;
CREATE POLICY "invoices_read_owner_or_staff" ON invoices FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM user_subscriptions us WHERE us.id = invoices.subscription_id AND us.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST'))
);

DROP POLICY IF EXISTS "invoices_staff_write" ON invoices;
CREATE POLICY "invoices_staff_write" ON invoices FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "checkout_orders_owner_read" ON checkout_orders;
CREATE POLICY "checkout_orders_owner_read" ON checkout_orders FOR SELECT TO authenticated
USING (member_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "payment_attempts_owner_read" ON payment_attempts;
CREATE POLICY "payment_attempts_owner_read" ON payment_attempts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM checkout_orders co WHERE co.id = payment_attempts.checkout_id AND co.member_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "payment_webhook_events_staff_read" ON payment_webhook_events;
CREATE POLICY "payment_webhook_events_staff_read" ON payment_webhook_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

-- Bookings & Coach Availability
DROP POLICY IF EXISTS "coach_avail_read_all" ON coach_availability;
CREATE POLICY "coach_avail_read_all" ON coach_availability FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "coach_avail_coach_write" ON coach_availability;
CREATE POLICY "coach_avail_coach_write" ON coach_availability FOR ALL TO authenticated
USING (coach_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

DROP POLICY IF EXISTS "bookings_read_party" ON bookings;
CREATE POLICY "bookings_read_party" ON bookings FOR SELECT TO authenticated
USING (
    member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST'))
    OR EXISTS (SELECT 1 FROM schedules s WHERE s.id = bookings.schedule_id AND s.coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM coach_availability ca WHERE ca.id = bookings.coach_availability_id AND ca.coach_id = auth.uid())
);

DROP POLICY IF EXISTS "bookings_member_insert" ON bookings;
CREATE POLICY "bookings_member_insert" ON bookings FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "bookings_party_update" ON bookings;
CREATE POLICY "bookings_party_update" ON bookings FOR UPDATE TO authenticated
USING (
    member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST'))
    OR EXISTS (SELECT 1 FROM schedules s WHERE s.id = bookings.schedule_id AND s.coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM coach_availability ca WHERE ca.id = bookings.coach_availability_id AND ca.coach_id = auth.uid())
);

-- Attendances, InBody & Lockers
DROP POLICY IF EXISTS "attendances_read_all_staff" ON attendances;
CREATE POLICY "attendances_read_all_staff" ON attendances FOR SELECT TO authenticated
USING (member_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST', 'COACH')));

DROP POLICY IF EXISTS "attendances_staff_write" ON attendances;
CREATE POLICY "attendances_staff_write" ON attendances FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST', 'COACH')));

DROP POLICY IF EXISTS "inbody_member_select" ON member_inbody_logs;
CREATE POLICY "inbody_member_select" ON member_inbody_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('COACH', 'ADMIN', 'CENTER_MANAGER')));

DROP POLICY IF EXISTS "inbody_staff_insert" ON member_inbody_logs;
CREATE POLICY "inbody_staff_insert" ON member_inbody_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('COACH', 'ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "locker_assignments_staff_all" ON locker_assignments;
CREATE POLICY "locker_assignments_staff_all" ON locker_assignments FOR ALL TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('RECEPTIONIST', 'ADMIN', 'CENTER_MANAGER')));

-- Workout Plans
DROP POLICY IF EXISTS "workout_plans_read" ON workout_plans;
CREATE POLICY "workout_plans_read" ON workout_plans FOR SELECT TO authenticated
USING (member_id = auth.uid() OR coach_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

DROP POLICY IF EXISTS "workout_plans_write" ON workout_plans;
CREATE POLICY "workout_plans_write" ON workout_plans FOR ALL TO authenticated
USING (coach_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

-- Cancellation Requests & Coach Penalties (DSS)
DROP POLICY IF EXISTS "cancellation_requests_select" ON cancellation_requests;
CREATE POLICY "cancellation_requests_select" ON cancellation_requests FOR SELECT TO authenticated
USING (coach_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "cancellation_requests_coach_insert" ON cancellation_requests;
CREATE POLICY "cancellation_requests_coach_insert" ON cancellation_requests FOR INSERT TO authenticated
WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "cancellation_requests_staff_update" ON cancellation_requests;
CREATE POLICY "cancellation_requests_staff_update" ON cancellation_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER', 'RECEPTIONIST')));

DROP POLICY IF EXISTS "coach_penalties_select" ON coach_penalties;
CREATE POLICY "coach_penalties_select" ON coach_penalties FOR SELECT TO authenticated
USING (coach_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

DROP POLICY IF EXISTS "coach_penalties_manager_update" ON coach_penalties;
CREATE POLICY "coach_penalties_manager_update" ON coach_penalties FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'CENTER_MANAGER')));

COMMIT;
