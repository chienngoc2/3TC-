-- =============================================================================
-- Migration: Add person name columns to all tables referencing users
-- =============================================================================

BEGIN;

-- 1. Add Columns IF NOT EXISTS
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(150);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE coach_rates ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE coach_availability ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS assigned_coach_name VARCHAR(150);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS verified_by_name VARCHAR(150);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issuer_name VARCHAR(150);
ALTER TABLE checkout_orders ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS staff_name VARCHAR(150);
ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS assigned_by_name VARCHAR(150);
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(150);
ALTER TABLE coach_penalties ADD COLUMN IF NOT EXISTS coach_name VARCHAR(150);
ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS measured_by_name VARCHAR(150);
ALTER TABLE locker_assignments ADD COLUMN IF NOT EXISTS user_name VARCHAR(150);
ALTER TABLE locker_assignments ADD COLUMN IF NOT EXISTS assigned_by_name VARCHAR(150);

-- 2. Backfill existing records from users table
UPDATE users u2 SET created_by_name = u1.full_name FROM users u1 WHERE u2.created_by_id = u1.id AND u2.created_by_name IS NULL;
UPDATE audit_logs a SET user_name = u.full_name FROM users u WHERE a.user_id = u.id AND a.user_name IS NULL;
UPDATE user_sessions s SET user_name = u.full_name FROM users u WHERE s.user_id = u.id AND s.user_name IS NULL;
UPDATE member_profiles mp SET user_name = u.full_name FROM users u WHERE mp.user_id = u.id AND mp.user_name IS NULL;
UPDATE coach_profiles cp SET user_name = u.full_name FROM users u WHERE cp.user_id = u.id AND cp.user_name IS NULL;
UPDATE coach_rates cr SET coach_name = u.full_name FROM users u WHERE cr.coach_id = u.id AND cr.coach_name IS NULL;
UPDATE coach_availability ca SET coach_name = u.full_name FROM users u WHERE ca.coach_id = u.id AND ca.coach_name IS NULL;
UPDATE schedules s SET coach_name = u.full_name FROM users u WHERE s.coach_id = u.id AND s.coach_name IS NULL;
UPDATE bookings b SET member_name = u.full_name FROM users u WHERE b.member_id = u.id AND b.member_name IS NULL;
UPDATE user_subscriptions us SET member_name = u.full_name FROM users u WHERE us.user_id = u.id AND us.member_name IS NULL;
UPDATE user_subscriptions us SET assigned_coach_name = u.full_name FROM users u WHERE us.assigned_coach_id = u.id AND us.assigned_coach_name IS NULL;
UPDATE attendances att SET member_name = u.full_name FROM users u WHERE att.member_id = u.id AND att.member_name IS NULL;
UPDATE attendances att SET verified_by_name = u.full_name FROM users u WHERE att.verified_by_id = u.id AND att.verified_by_name IS NULL;
UPDATE invoices inv SET issuer_name = u.full_name FROM users u WHERE inv.issuer_id = u.id AND inv.issuer_name IS NULL;
UPDATE checkout_orders co SET member_name = u.full_name FROM users u WHERE co.member_id = u.id AND co.member_name IS NULL;
UPDATE staff_shifts ss SET staff_name = u.full_name FROM users u WHERE ss.staff_id = u.id AND ss.staff_name IS NULL;
UPDATE staff_shifts ss SET assigned_by_name = u.full_name FROM users u WHERE ss.assigned_by_id = u.id AND ss.assigned_by_name IS NULL;
UPDATE workout_plans wp SET member_name = u.full_name FROM users u WHERE wp.member_id = u.id AND wp.member_name IS NULL;
UPDATE workout_plans wp SET coach_name = u.full_name FROM users u WHERE wp.coach_id = u.id AND wp.coach_name IS NULL;
UPDATE cancellation_requests cr SET coach_name = u.full_name FROM users u WHERE cr.coach_id = u.id AND cr.coach_name IS NULL;
UPDATE cancellation_requests cr SET reviewed_by_name = u.full_name FROM users u WHERE cr.reviewed_by_id = u.id AND cr.reviewed_by_name IS NULL;
UPDATE coach_penalties cp SET coach_name = u.full_name FROM users u WHERE cp.coach_id = u.id AND cp.coach_name IS NULL;
UPDATE member_inbody_logs ml SET user_name = u.full_name FROM users u WHERE ml.user_id = u.id AND ml.user_name IS NULL;
UPDATE member_inbody_logs ml SET measured_by_name = u.full_name FROM users u WHERE ml.measured_by_id = u.id AND ml.measured_by_name IS NULL;
UPDATE locker_assignments la SET user_name = u.full_name FROM users u WHERE la.user_id = u.id AND la.user_name IS NULL;
UPDATE locker_assignments la SET assigned_by_name = u.full_name FROM users u WHERE la.assigned_by_id = u.id AND la.assigned_by_name IS NULL;

-- 3. Create Trigger Function to auto-populate on INSERT or UPDATE
CREATE OR REPLACE FUNCTION fn_sync_person_name()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.created_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.created_by_name FROM users WHERE id = NEW.created_by_id;
    END IF;
  ELSIF TG_TABLE_NAME IN ('audit_logs', 'user_sessions', 'member_profiles', 'coach_profiles') THEN
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO NEW.user_name FROM users WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'bookings' THEN
    IF NEW.member_id IS NOT NULL THEN
      SELECT full_name INTO NEW.member_name FROM users WHERE id = NEW.member_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'user_subscriptions' THEN
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO NEW.member_name FROM users WHERE id = NEW.user_id;
    END IF;
    IF NEW.assigned_coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.assigned_coach_name FROM users WHERE id = NEW.assigned_coach_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'attendances' THEN
    IF NEW.member_id IS NOT NULL THEN
      SELECT full_name INTO NEW.member_name FROM users WHERE id = NEW.member_id;
    END IF;
    IF NEW.verified_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.verified_by_name FROM users WHERE id = NEW.verified_by_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'coach_availability' THEN
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'schedules' THEN
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.issuer_id IS NOT NULL THEN
      SELECT full_name INTO NEW.issuer_name FROM users WHERE id = NEW.issuer_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'checkout_orders' THEN
    IF NEW.member_id IS NOT NULL THEN
      SELECT full_name INTO NEW.member_name FROM users WHERE id = NEW.member_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'staff_shifts' THEN
    IF NEW.staff_id IS NOT NULL THEN
      SELECT full_name INTO NEW.staff_name FROM users WHERE id = NEW.staff_id;
    END IF;
    IF NEW.assigned_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.assigned_by_name FROM users WHERE id = NEW.assigned_by_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workout_plans' THEN
    IF NEW.member_id IS NOT NULL THEN
      SELECT full_name INTO NEW.member_name FROM users WHERE id = NEW.member_id;
    END IF;
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'cancellation_requests' THEN
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
    IF NEW.reviewed_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.reviewed_by_name FROM users WHERE id = NEW.reviewed_by_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'coach_penalties' THEN
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'member_inbody_logs' THEN
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO NEW.user_name FROM users WHERE id = NEW.user_id;
    END IF;
    IF NEW.measured_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.measured_by_name FROM users WHERE id = NEW.measured_by_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'locker_assignments' THEN
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO NEW.user_name FROM users WHERE id = NEW.user_id;
    END IF;
    IF NEW.assigned_by_id IS NOT NULL THEN
      SELECT full_name INTO NEW.assigned_by_name FROM users WHERE id = NEW.assigned_by_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'coach_rates' THEN
    IF NEW.coach_id IS NOT NULL THEN
      SELECT full_name INTO NEW.coach_name FROM users WHERE id = NEW.coach_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Triggers on each table
DROP TRIGGER IF EXISTS trg_sync_name_users ON users;
CREATE TRIGGER trg_sync_name_users BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_audit_logs ON audit_logs;
CREATE TRIGGER trg_sync_name_audit_logs BEFORE INSERT OR UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_user_sessions ON user_sessions;
CREATE TRIGGER trg_sync_name_user_sessions BEFORE INSERT OR UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_member_profiles ON member_profiles;
CREATE TRIGGER trg_sync_name_member_profiles BEFORE INSERT OR UPDATE ON member_profiles FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_coach_profiles ON coach_profiles;
CREATE TRIGGER trg_sync_name_coach_profiles BEFORE INSERT OR UPDATE ON coach_profiles FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_coach_rates ON coach_rates;
CREATE TRIGGER trg_sync_name_coach_rates BEFORE INSERT OR UPDATE ON coach_rates FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_coach_availability ON coach_availability;
CREATE TRIGGER trg_sync_name_coach_availability BEFORE INSERT OR UPDATE ON coach_availability FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_schedules ON schedules;
CREATE TRIGGER trg_sync_name_schedules BEFORE INSERT OR UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_bookings ON bookings;
CREATE TRIGGER trg_sync_name_bookings BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_user_subscriptions ON user_subscriptions;
CREATE TRIGGER trg_sync_name_user_subscriptions BEFORE INSERT OR UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_attendances ON attendances;
CREATE TRIGGER trg_sync_name_attendances BEFORE INSERT OR UPDATE ON attendances FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_invoices ON invoices;
CREATE TRIGGER trg_sync_name_invoices BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_checkout_orders ON checkout_orders;
CREATE TRIGGER trg_sync_name_checkout_orders BEFORE INSERT OR UPDATE ON checkout_orders FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_staff_shifts ON staff_shifts;
CREATE TRIGGER trg_sync_name_staff_shifts BEFORE INSERT OR UPDATE ON staff_shifts FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_workout_plans ON workout_plans;
CREATE TRIGGER trg_sync_name_workout_plans BEFORE INSERT OR UPDATE ON workout_plans FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_cancellation_requests ON cancellation_requests;
CREATE TRIGGER trg_sync_name_cancellation_requests BEFORE INSERT OR UPDATE ON cancellation_requests FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_coach_penalties ON coach_penalties;
CREATE TRIGGER trg_sync_name_coach_penalties BEFORE INSERT OR UPDATE ON coach_penalties FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_member_inbody_logs ON member_inbody_logs;
CREATE TRIGGER trg_sync_name_member_inbody_logs BEFORE INSERT OR UPDATE ON member_inbody_logs FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

DROP TRIGGER IF EXISTS trg_sync_name_locker_assignments ON locker_assignments;
CREATE TRIGGER trg_sync_name_locker_assignments BEFORE INSERT OR UPDATE ON locker_assignments FOR EACH ROW EXECUTE FUNCTION fn_sync_person_name();

-- 5. Trigger when user full_name changes in users table
CREATE OR REPLACE FUNCTION fn_propagate_user_name_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    UPDATE users SET created_by_name = NEW.full_name WHERE created_by_id = NEW.id;
    UPDATE audit_logs SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE user_sessions SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE member_profiles SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE coach_profiles SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE bookings SET member_name = NEW.full_name WHERE member_id = NEW.id;
    UPDATE user_subscriptions SET member_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE user_subscriptions SET assigned_coach_name = NEW.full_name WHERE assigned_coach_id = NEW.id;
    UPDATE attendances SET member_name = NEW.full_name WHERE member_id = NEW.id;
    UPDATE attendances SET verified_by_name = NEW.full_name WHERE verified_by_id = NEW.id;
    UPDATE coach_availability SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
    UPDATE schedules SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
    UPDATE invoices SET issuer_name = NEW.full_name WHERE issuer_id = NEW.id;
    UPDATE checkout_orders SET member_name = NEW.full_name WHERE member_id = NEW.id;
    UPDATE staff_shifts SET staff_name = NEW.full_name WHERE staff_id = NEW.id;
    UPDATE staff_shifts SET assigned_by_name = NEW.full_name WHERE assigned_by_id = NEW.id;
    UPDATE workout_plans SET member_name = NEW.full_name WHERE member_id = NEW.id;
    UPDATE workout_plans SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
    UPDATE cancellation_requests SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
    UPDATE cancellation_requests SET reviewed_by_name = NEW.full_name WHERE reviewed_by_id = NEW.id;
    UPDATE coach_penalties SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
    UPDATE member_inbody_logs SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE member_inbody_logs SET measured_by_name = NEW.full_name WHERE measured_by_id = NEW.id;
    UPDATE locker_assignments SET user_name = NEW.full_name WHERE user_id = NEW.id;
    UPDATE locker_assignments SET assigned_by_name = NEW.full_name WHERE assigned_by_id = NEW.id;
    UPDATE coach_rates SET coach_name = NEW.full_name WHERE coach_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_user_name_change ON users;
CREATE TRIGGER trg_propagate_user_name_change AFTER UPDATE OF full_name ON users FOR EACH ROW EXECUTE FUNCTION fn_propagate_user_name_change();

COMMIT;
