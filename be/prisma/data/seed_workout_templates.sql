-- ==============================================================================
-- 1. TẠO BẢNG LƯU TRỮ WORKOUT TEMPLATES & WORKOUT TEMPLATE EXERCISES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(50) NOT NULL UNIQUE,
    discipline_code VARCHAR(20) NOT NULL,
    title VARCHAR(150) NOT NULL,
    week_number INT NOT NULL,
    session_order INT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercise_knowledge(id) ON DELETE RESTRICT,
    sets INT,
    reps INT,
    unit VARCHAR(20) DEFAULT 'reps',
    weight_kg DECIMAL(5, 2),
    rest_seconds INT,
    order_index INT NOT NULL DEFAULT 0
);

-- ==============================================================================
-- 2. BỔ SUNG CỘT LIÊN KẾT BUỔI TẬP (BOOKING) VÀO WORKOUT_PLANS THỰC TẾ CỦA HỘI VIÊN
-- ==============================================================================

ALTER TABLE workout_plans 
    ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS session_order INT;

-- ==============================================================================
-- 3. KÍCH HOẠT ROW LEVEL SECURITY (RLS) VÀ PHÂN QUYỀN TRUY VẤN
-- ==============================================================================

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workout_templates_read_all') THEN
        CREATE POLICY "workout_templates_read_all" ON workout_templates FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workout_template_exercises_read_all') THEN
        CREATE POLICY "workout_template_exercises_read_all" ON workout_template_exercises FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- ==============================================================================
-- 4. INSERT DỮ LIỆU 24 TEMPLATES (BOXING: 12 BUỔI, YOGA: 12 BUỔI)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CHƯƠNG TRÌNH: BOXING (12 BUỔI)
-- ------------------------------------------------------------------------------

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('31e4cb3f-f48d-4ea1-a299-c5a44a65a958', 'WORKOUT_PLAN_BOXING_01', 'BOXING', 'Nền tảng: Tư thế & Jab-Cross', 1, 1, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('330ab56b-f4cb-4e29-a2c7-4490ecd27f67', '31e4cb3f-f48d-4ea1-a299-c5a44a65a958', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 3, 120, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('2d4d787d-5993-49b4-ad3a-cb4c9383063e', '31e4cb3f-f48d-4ea1-a299-c5a44a65a958', 'f8ad2caf-1f48-449c-a7c5-7e5f79aeef0c', 3, 60, 'seconds', NULL, 30, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('a134e785-de44-411d-a95c-d298da20c20f', '31e4cb3f-f48d-4ea1-a299-c5a44a65a958', '922de3d3-28c6-4d8a-af16-1ab2eb78243a', 4, 20, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5dd033f8-594e-4cfb-a852-cd0fd32dc212', '31e4cb3f-f48d-4ea1-a299-c5a44a65a958', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 3, 180, 'seconds', NULL, 60, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('f01ecb47-68a0-410f-adca-40ac6c3c61e2', '31e4cb3f-f48d-4ea1-a299-c5a44a65a958', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 30, 'seconds', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('aec2fd2c-c5cf-483e-a791-8f64b00ef18c', 'WORKOUT_PLAN_BOXING_02', 'BOXING', 'Thể lực Boxing cơ bản', 1, 2, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('fe77a0a2-d6f9-4b89-ac02-a7df76ff3fc1', 'aec2fd2c-c5cf-483e-a791-8f64b00ef18c', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 3, 150, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('7e06467d-af13-4165-a991-005a4760ec63', 'aec2fd2c-c5cf-483e-a791-8f64b00ef18c', '1f44548d-1e9b-44b1-a415-61ff8be2d318', 3, 15, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('14542fa9-4bb5-4b6e-a4c0-1fe9bf8f8eae', 'aec2fd2c-c5cf-483e-a791-8f64b00ef18c', '6c54d008-bf94-4af5-ae76-40d25a766aa9', 3, 10, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('7026f272-28cb-4072-a965-73391b4d5922', 'aec2fd2c-c5cf-483e-a791-8f64b00ef18c', '47904c15-0f11-414d-ab42-c05406726659', 3, 20, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ff601a58-c292-4ce6-a550-9a30aab665e7', 'aec2fd2c-c5cf-483e-a791-8f64b00ef18c', '2aa9de4d-6976-488a-a48d-1092199c5a03', 3, 15, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', 'WORKOUT_PLAN_BOXING_03', 'BOXING', 'Đấm bao cơ bản', 1, 3, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('459ac09d-156a-4f06-a66d-567f675a2f73', 'a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 2, 180, 'seconds', NULL, 60, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('673f2660-89c4-41e2-aead-a1fd081a6500', 'a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', '69b11ef5-85bf-4b28-af7f-b18792e64626', 3, 120, 'seconds', NULL, 60, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('40f29013-6fe0-489e-a07e-872753f141ac', 'a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', '922de3d3-28c6-4d8a-af16-1ab2eb78243a', 3, 20, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('fad319ac-b25a-4c94-a2f8-913fe4cfb3bf', 'a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', '40669037-e7aa-4539-afdf-58f10159a41a', 3, 15, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('fe52b53d-0fad-4b8c-a284-362b1ac24c3f', 'a294ed4f-c7d1-4327-a79e-d2c9d8a8b377', 'f7a8ac28-2a6d-47f3-ace8-9652d932a628', 3, 20, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('e754d172-18e0-4e30-a112-6e9697710658', 'WORKOUT_PLAN_BOXING_04', 'BOXING', 'Hook & Combo Jab-Cross-Hook', 2, 4, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('b5caf1a5-652a-4e6a-aff1-7c22dc62e9c8', 'e754d172-18e0-4e30-a112-6e9697710658', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 3, 150, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c83a7d9e-8684-452c-a3e5-25cc24a37bd9', 'e754d172-18e0-4e30-a112-6e9697710658', '1a2ae86d-cb64-4f21-a590-8acb5d930641', 4, 20, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('cfd50a71-07e8-4fcf-a7f4-0715dd7c5156', 'e754d172-18e0-4e30-a112-6e9697710658', 'aeeccb4e-487b-40f7-ae3f-25d7500f6d43', 4, 15, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('891fb1d0-a420-4075-aa53-a41a65bab7b5', 'e754d172-18e0-4e30-a112-6e9697710658', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 3, 180, 'seconds', NULL, 60, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('12c1b5f1-352b-409c-a52c-67823872cddb', 'e754d172-18e0-4e30-a112-6e9697710658', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 40, 'seconds', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('7b14ad81-407a-4c60-aec2-83df7b1ad382', 'WORKOUT_PLAN_BOXING_05', 'BOXING', 'Phòng thủ & Di chuyển', 2, 5, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('052bd191-341e-4b5d-a2d2-05bea5608915', '7b14ad81-407a-4c60-aec2-83df7b1ad382', 'f8ad2caf-1f48-449c-a7c5-7e5f79aeef0c', 3, 90, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('52955dbe-a6f1-46d0-a0a6-760a24345dfd', '7b14ad81-407a-4c60-aec2-83df7b1ad382', '8b90385c-77aa-4f9c-aa69-768b3a82aff8', 4, 20, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('71fa7fa4-65bc-4b7d-a66c-94c95eedda31', '7b14ad81-407a-4c60-aec2-83df7b1ad382', '40669037-e7aa-4539-afdf-58f10159a41a', 3, 20, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('21677869-e18c-4023-a9c4-a245e7ccad28', '7b14ad81-407a-4c60-aec2-83df7b1ad382', '68a3b619-81f1-41d9-a5d6-bfeed5a26479', 3, 120, 'seconds', NULL, 60, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('4d8b18ea-d5cb-49c3-a035-51599dd831dd', '7b14ad81-407a-4c60-aec2-83df7b1ad382', '9d837ee6-3c32-4241-a028-67d8a499b882', 3, 12, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('05636677-12e8-48d2-a483-598829e69a26', 'WORKOUT_PLAN_BOXING_06', 'BOXING', 'Đấm bao & Core', 2, 6, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('683b2c26-882c-4c31-a5bd-7fabd8a2548c', '05636677-12e8-48d2-a483-598829e69a26', '69b11ef5-85bf-4b28-af7f-b18792e64626', 4, 120, 'seconds', NULL, 60, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('9bcba95e-0e63-4e60-ad7a-4db4afe82883', '05636677-12e8-48d2-a483-598829e69a26', 'aeeccb4e-487b-40f7-ae3f-25d7500f6d43', 3, 15, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('51aac27c-193a-4599-acd2-ceede2873000', '05636677-12e8-48d2-a483-598829e69a26', 'f7a8ac28-2a6d-47f3-ace8-9652d932a628', 3, 20, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('252cbc3d-bcd1-45d4-a6b5-86b0624a162f', '05636677-12e8-48d2-a483-598829e69a26', '2aa9de4d-6976-488a-a48d-1092199c5a03', 3, 20, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('120b1b21-e785-47c3-a52f-163ad16c9983', '05636677-12e8-48d2-a483-598829e69a26', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 45, 'seconds', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('2648d02d-0a41-4926-a436-dcb1765d8933', 'WORKOUT_PLAN_BOXING_07', 'BOXING', 'Uppercut & Combo 4-5 đòn', 3, 7, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('86baed10-db7a-458f-afc2-cf34440405f3', '2648d02d-0a41-4926-a436-dcb1765d8933', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 3, 180, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8a0c4591-3fb6-4fa0-ab1d-f65b5c99f621', '2648d02d-0a41-4926-a436-dcb1765d8933', '7e07ecd1-2551-43ab-a78a-a3976fcb09af', 4, 20, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('3141b9dc-414d-46be-a977-4479857868a8', '2648d02d-0a41-4926-a436-dcb1765d8933', 'cf4e8179-2f69-4d3a-a102-a3395af6b481', 4, 12, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('1287596f-e6f8-4318-a8fe-d3419755dc92', '2648d02d-0a41-4926-a436-dcb1765d8933', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 3, 180, 'seconds', NULL, 60, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('45090e65-47c5-458f-ad26-e28be1d551b2', '2648d02d-0a41-4926-a436-dcb1765d8933', '47904c15-0f11-414d-ab42-c05406726659', 3, 20, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('88516627-849b-4ca5-ae96-54b7a0c6ef7c', 'WORKOUT_PLAN_BOXING_08', 'BOXING', 'Cardio cường độ cao', 3, 8, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5c443f8d-99e1-4f2d-a848-dd2df749c09b', '88516627-849b-4ca5-ae96-54b7a0c6ef7c', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 4, 120, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ce05781e-dd32-4f4a-aede-a0b8f11b2c56', '88516627-849b-4ca5-ae96-54b7a0c6ef7c', '92daa886-0f91-41c2-a288-8a137e8c37b4', 3, 10, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d86c3a83-9cf6-4124-a0db-322d03a71ba7', '88516627-849b-4ca5-ae96-54b7a0c6ef7c', 'ceb9de0d-d646-49a7-ab3b-87ef4bd4e29d', 3, 12, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('fe46dc3e-313c-4955-a454-ce6cca833b04', '88516627-849b-4ca5-ae96-54b7a0c6ef7c', '26f091fd-0704-4fe8-aecd-2dd630f70bba', 3, 30, 'reps', NULL, 30, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('3d009c94-7fc0-4e86-a988-bb1f8745f1e6', '88516627-849b-4ca5-ae96-54b7a0c6ef7c', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 45, 'seconds', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', 'WORKOUT_PLAN_BOXING_09', 'BOXING', 'Pad work (Đấm bia)', 3, 9, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8471a8f0-ae6b-4edb-a253-f6c7bb17d3a5', 'c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 2, 180, 'seconds', NULL, 60, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('297a5830-d603-4523-acba-c9537fd2b411', 'c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', '68a3b619-81f1-41d9-a5d6-bfeed5a26479', 5, 120, 'seconds', NULL, 60, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('e9bb213a-53e4-4432-ab8b-0a75abaac778', 'c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', 'cb173f59-bd09-4b2f-aa69-a3b2bfc409f1', 3, 15, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('dfb86e14-91a5-4d2f-a108-8604248e30c3', 'c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', '8b90385c-77aa-4f9c-aa69-768b3a82aff8', 3, 20, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('49c90863-5fd7-47d4-a0c9-a9a76c04b277', 'c376c8f6-5abf-44a1-a5e2-8b77cc41bcd9', 'f7a8ac28-2a6d-47f3-ace8-9652d932a628', 3, 20, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', 'WORKOUT_PLAN_BOXING_10', 'BOXING', 'Combo nâng cao & Phản đòn', 4, 10, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('048aa5a7-9700-47d8-ae23-d06de4343455', '038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 3, 180, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('89c7b747-27d6-43e6-a567-69bfea25cfcd', '038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', 'cf4e8179-2f69-4d3a-a102-a3395af6b481', 4, 15, 'reps', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('abeda1bc-30c5-4450-a6a1-c856e14281d9', '038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', 'cb173f59-bd09-4b2f-aa69-a3b2bfc409f1', 4, 15, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('65f4a67d-54e8-4ed4-a57c-9a46ad1a78f0', '038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', '69b11ef5-85bf-4b28-af7f-b18792e64626', 4, 150, 'seconds', NULL, 60, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('a96a6efb-6211-449f-aaf6-76561716c57f', '038973db-1ffa-4fc0-a2f9-6ae7bbedb33c', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 50, 'seconds', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', 'WORKOUT_PLAN_BOXING_11', 'BOXING', 'Sức bền Boxing (HIIT)', 4, 11, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ebfcf04d-e014-4c0d-a699-3828e36cd1ef', '4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', 'bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 4, 150, 'seconds', NULL, 30, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('3f23cb71-2436-4446-ab17-dd7569660853', '4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', '69b11ef5-85bf-4b28-af7f-b18792e64626', 5, 120, 'seconds', NULL, 45, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('3b59a1d3-9705-4ef0-a2ea-18dd8b259795', '4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', '92daa886-0f91-41c2-a288-8a137e8c37b4', 4, 10, 'reps', NULL, 45, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5f37a2ad-db5e-469a-accb-a979b5971191', '4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', 'ceb9de0d-d646-49a7-ab3b-87ef4bd4e29d', 3, 15, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('054ed0bd-ca23-4689-a86b-6cb83c5b2654', '4aa4bb26-6a5a-403e-a69e-6e6e2c504c0c', '47904c15-0f11-414d-ab42-c05406726659', 4, 20, 'reps', NULL, 45, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('b77b189f-fba1-4698-a636-caaa397ec16c', 'WORKOUT_PLAN_BOXING_12', 'BOXING', 'Tổng hợp & Sparring nhẹ', 4, 12, 'Boxing 4 tuần: nền tảng → combo & phòng thủ → cường độ cao → tổng hợp. Mỗi ''round'' = sets × reps(giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('84d91e02-4d89-412f-a46a-d8b8bc28376e', 'b77b189f-fba1-4698-a636-caaa397ec16c', '0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 2, 180, 'seconds', NULL, 60, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('aafaefeb-f6ee-46f5-a117-731118e54db1', 'b77b189f-fba1-4698-a636-caaa397ec16c', '68a3b619-81f1-41d9-a5d6-bfeed5a26479', 4, 150, 'seconds', NULL, 60, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('246a56a8-8208-4a04-a93a-08373d099a8b', 'b77b189f-fba1-4698-a636-caaa397ec16c', '542351a9-d635-4c89-a636-87c2aad23d24', 3, 120, 'seconds', NULL, 90, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('7e447574-c985-46a5-a2ca-bfca2dbf16e7', 'b77b189f-fba1-4698-a636-caaa397ec16c', '8b90385c-77aa-4f9c-aa69-768b3a82aff8', 3, 20, 'reps', NULL, 45, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('dcb1a66c-58e2-405c-a0dd-295a11d1092a', 'b77b189f-fba1-4698-a636-caaa397ec16c', '53aa978d-7e8b-45a8-a2d1-977d6f047334', 1, 5, 'minutes', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;


-- ------------------------------------------------------------------------------
-- CHƯƠNG TRÌNH: YOGA (12 BUỔI)
-- ------------------------------------------------------------------------------

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('90efaad8-52cc-4144-ab96-643984ee49c3', 'WORKOUT_PLAN_YOGA_01', 'YOGA', 'Nền tảng & Hơi thở', 1, 1, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('196cf741-ef24-4b46-a3bc-2b13e3c8bc7a', '90efaad8-52cc-4144-ab96-643984ee49c3', 'e995314d-dbb0-4d30-a6b9-a0fd906ddab2', 1, 120, 'seconds', NULL, 0, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d7837170-ca5c-4314-a2fd-55bc17f84aca', '90efaad8-52cc-4144-ab96-643984ee49c3', '6e41d48d-0ae9-497f-a208-78413792afca', 2, 45, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d372b05f-cd94-437a-ac24-0522980fa912', '90efaad8-52cc-4144-ab96-643984ee49c3', '2e88a567-f76e-4afc-a378-4d1da0266fc0', 3, 30, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('6f478a29-5260-4835-a043-8190d6cbfc01', '90efaad8-52cc-4144-ab96-643984ee49c3', '8c58af33-565d-4692-a409-39ccec02aa6f', 2, 45, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d8eea022-cad0-4976-a014-990a60e9c07a', '90efaad8-52cc-4144-ab96-643984ee49c3', 'e98a81f3-d5a4-484e-a377-671f3291ced8', 3, 20, 'seconds', NULL, 10, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('9398c2ca-f6f5-4308-aa50-f787e50b5151', '90efaad8-52cc-4144-ab96-643984ee49c3', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('69082c53-44a0-4fbc-a128-2a5d4904bb4f', 'WORKOUT_PLAN_YOGA_02', 'YOGA', 'Chào mặt trời A', 1, 2, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('b65ef391-d3ba-4a54-a7de-32d631b80315', '69082c53-44a0-4fbc-a128-2a5d4904bb4f', '2f100ac8-26c3-4d81-ad39-c19027b9a3e9', 1, 30, 'seconds', NULL, 0, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('48df59d6-2499-4402-a5c3-8be191983093', '69082c53-44a0-4fbc-a128-2a5d4904bb4f', 'f26dd04d-c8d5-4b5d-af38-8b2e4f1b4075', 1, 5, 'rounds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('9151a17c-b459-4d84-a571-ec5b7d8fd13c', '69082c53-44a0-4fbc-a128-2a5d4904bb4f', '2e88a567-f76e-4afc-a378-4d1da0266fc0', 2, 30, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('dd203131-be3b-411b-aeee-9ef4e1f4ea88', '69082c53-44a0-4fbc-a128-2a5d4904bb4f', '8c58af33-565d-4692-a409-39ccec02aa6f', 1, 60, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c3e9da5c-6f78-4793-a3ab-1f59c5162f11', '69082c53-44a0-4fbc-a128-2a5d4904bb4f', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('93361cb2-4856-49cb-a64f-2be84a8da988', 'WORKOUT_PLAN_YOGA_03', 'YOGA', 'Linh hoạt thân dưới', 1, 3, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('00b7e0d2-8683-426f-ae88-b243130d3edc', '93361cb2-4856-49cb-a64f-2be84a8da988', '121d0d1e-9cc7-4dc9-ad15-ca22f079161a', 2, 40, 'seconds', NULL, 10, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('4a425cf1-bc95-4f34-a161-08c31bd0e62c', '93361cb2-4856-49cb-a64f-2be84a8da988', 'd0212daa-a1fb-4683-a89a-452086252feb', 3, 40, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('0639133b-8aef-4aed-a826-2ce54bc354a0', '93361cb2-4856-49cb-a64f-2be84a8da988', 'da86160b-2e2f-4f84-a4d0-a3a2e66c7b3f', 2, 45, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('48e424ff-56d5-4ba8-ad25-8745779213ab', '93361cb2-4856-49cb-a64f-2be84a8da988', '05cbc0b3-b510-4e3a-ac22-8911ac4b2089', 2, 45, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('80558d1c-14c4-4251-a5ea-19dafeaa6d1c', '93361cb2-4856-49cb-a64f-2be84a8da988', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', 'WORKOUT_PLAN_YOGA_04', 'YOGA', 'Tư thế đứng & Chân khỏe', 2, 4, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('faea1fc0-1156-4c78-a21b-80662edfe467', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', 'f26dd04d-c8d5-4b5d-af38-8b2e4f1b4075', 1, 3, 'rounds', NULL, 15, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('dbe4c565-1c8d-4cec-a055-844f6f8dcdc4', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', '674bd11b-5c55-4dfb-a1e1-04dee18d2074', 2, 30, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('bf4ea884-a351-4b63-a31c-2cbcc3fb9fab', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', '75c8538b-ba2f-41a8-a9a3-c045c5d03bab', 2, 30, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('481aae7f-2785-469c-ae4d-9b1bd9f02eee', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', '1b83045e-12a3-4dc8-a969-b90be2c2b880', 2, 30, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('fe6c6491-f94c-4571-aaec-8226787a88b9', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', '8336a70c-3094-473f-a65b-09b80e12e60d', 2, 30, 'seconds', NULL, 10, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('197dba37-1f15-4494-aa3f-113130ce4f8a', '97b1e178-2a5b-4b0f-ab19-5c7a16bd2b03', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('3251f3df-a9b8-4756-a0be-e6a52b17dcb4', 'WORKOUT_PLAN_YOGA_05', 'YOGA', 'Core & Lưng', 2, 5, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ff832b6f-87ab-40c1-a6fa-f605822af246', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', '6e41d48d-0ae9-497f-a208-78413792afca', 2, 45, 'seconds', NULL, 10, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('321069d9-ac54-4d78-ac15-6dcc042b076a', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', 'b639f019-a2d6-4b14-aefc-bc91a0af6e85', 3, 20, 'seconds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ed73064f-517a-49d9-a209-479ac080c211', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 30, 'seconds', NULL, 15, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5ea32fd1-2699-466f-acd0-2aca96f9322c', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', '72ba0383-d5a3-4d9f-a6ca-b61b381eeb12', 3, 30, 'seconds', NULL, 15, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('a2703320-4c93-4ac8-aa7b-d272fd136d9d', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', 'b7c1eeac-2315-43ba-aa91-8584a72737af', 2, 30, 'seconds', NULL, 10, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c83e04e1-238b-49c4-ac95-80a4a19bf147', '3251f3df-a9b8-4756-a0be-e6a52b17dcb4', '8c58af33-565d-4692-a409-39ccec02aa6f', 1, 60, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('5a385828-bb27-4c2c-afd5-1d092c7241bb', 'WORKOUT_PLAN_YOGA_06', 'YOGA', 'Giãn vai – gáy – hông', 2, 6, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c6a02652-1036-431f-a57d-3639a78f9543', '5a385828-bb27-4c2c-afd5-1d092c7241bb', '1af66afa-f28f-4db0-a63a-dd052edf9e1f', 2, 40, 'seconds', NULL, 10, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('518a2c32-ff09-49fe-a1fb-9573d002019b', '5a385828-bb27-4c2c-afd5-1d092c7241bb', '7d99f6a8-0d72-4b8b-acea-8d8264c04324', 2, 30, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('6b03e5a4-a9cd-452a-affd-4b8d7e9cd950', '5a385828-bb27-4c2c-afd5-1d092c7241bb', 'b6a15f77-195a-4fed-ae76-b7d758eabedd', 2, 40, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5a0bf346-89a8-4c4a-a6ad-c18a82aa9988', '5a385828-bb27-4c2c-afd5-1d092c7241bb', 'da86160b-2e2f-4f84-a4d0-a3a2e66c7b3f', 2, 50, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('3c1e9607-e5c8-4dfd-aa56-fad18190937e', '5a385828-bb27-4c2c-afd5-1d092c7241bb', '0fc67e23-2fbb-46ed-aff1-dac8545eb722', 2, 40, 'seconds', NULL, 10, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('89a5323a-b6c4-4d6c-a73c-9a47fa3eafa1', '5a385828-bb27-4c2c-afd5-1d092c7241bb', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('e9c6da23-d56e-4b07-a332-1be21ab92e42', 'WORKOUT_PLAN_YOGA_07', 'YOGA', 'Flow sức mạnh', 3, 7, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('cc79818a-25b4-4c4f-ad3f-f79c331ab06c', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', 'f26dd04d-c8d5-4b5d-af38-8b2e4f1b4075', 1, 6, 'rounds', NULL, 15, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('a0d1108d-caaf-4dfd-ae8e-8a176f206539', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', '11a6cb52-9af4-4c26-a747-be0d40adb538', 3, 30, 'seconds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d76fe1f9-064e-4bb9-a57e-fc3968600602', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', '75c8538b-ba2f-41a8-a9a3-c045c5d03bab', 2, 40, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('09316247-ca0b-4fb6-a787-8303df6596ba', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 40, 'seconds', NULL, 15, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('46554e4c-489e-4bdf-ab9f-9bf01f2c0279', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', '2e88a567-f76e-4afc-a378-4d1da0266fc0', 2, 45, 'seconds', NULL, 10, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8f2344cd-0331-46b3-ac6e-c9c62f5e3787', 'e9c6da23-d56e-4b07-a332-1be21ab92e42', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('357c95ad-e1d8-43cc-acd9-aa1fb42743b3', 'WORKOUT_PLAN_YOGA_08', 'YOGA', 'Thăng bằng', 3, 8, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('9b2ae18d-b56e-477e-a66d-048d5022e393', '357c95ad-e1d8-43cc-acd9-aa1fb42743b3', '8336a70c-3094-473f-a65b-09b80e12e60d', 2, 40, 'seconds', NULL, 10, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ebd38b56-30f7-46b6-a08b-a3bf34706953', '357c95ad-e1d8-43cc-acd9-aa1fb42743b3', 'e53d7b4d-d192-417f-a0af-e8539bbfe254', 2, 30, 'seconds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('027bc908-a8a6-4623-a82a-fb7ea818baeb', '357c95ad-e1d8-43cc-acd9-aa1fb42743b3', '97b39b03-e9e3-4fef-a490-f174668dd654', 2, 30, 'seconds', NULL, 15, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('deae7fc8-4678-4820-a1a7-6d16fd3dfbd2', '357c95ad-e1d8-43cc-acd9-aa1fb42743b3', '7d99f6a8-0d72-4b8b-acea-8d8264c04324', 2, 30, 'seconds', NULL, 10, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('1a421acb-5c5f-4887-a813-011b007ca44a', '357c95ad-e1d8-43cc-acd9-aa1fb42743b3', '8c58af33-565d-4692-a409-39ccec02aa6f', 1, 60, 'seconds', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('4d18812b-8028-40de-a52a-1245b19467dc', 'WORKOUT_PLAN_YOGA_09', 'YOGA', 'Mở hông & Lưng', 3, 9, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('968bcb57-2551-4dac-ac2c-393a5d63a147', '4d18812b-8028-40de-a52a-1245b19467dc', '9efa03e0-52ee-49f5-a887-f6178dd193dd', 3, 40, 'seconds', NULL, 10, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('f9c3dfc5-489e-4081-abef-7bf566ce2fc9', '4d18812b-8028-40de-a52a-1245b19467dc', 'b6a15f77-195a-4fed-ae76-b7d758eabedd', 2, 45, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('e5221c1c-602b-4a00-a25d-8a9fcb3975c0', '4d18812b-8028-40de-a52a-1245b19467dc', 'da86160b-2e2f-4f84-a4d0-a3a2e66c7b3f', 2, 60, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c4808052-8ba0-49ee-a4d0-3dd89461a6b0', '4d18812b-8028-40de-a52a-1245b19467dc', '9e97c598-3644-4eec-a5e7-ecc803b6ded8', 2, 30, 'seconds', NULL, 15, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('665220b9-ff68-45dd-a1d6-a73e445c0c2c', '4d18812b-8028-40de-a52a-1245b19467dc', '8c58af33-565d-4692-a409-39ccec02aa6f', 2, 60, 'seconds', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('545edbca-86d0-40e2-ae71-8c6dc4bd1956', '4d18812b-8028-40de-a52a-1245b19467dc', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', 'WORKOUT_PLAN_YOGA_10', 'YOGA', 'Power Flow', 4, 10, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8780fd32-15cd-44f6-a013-7b565caf6fde', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', '6e0c4f7a-ab1c-4a47-ae69-e006d3622d86', 1, 5, 'rounds', NULL, 15, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('947ace06-2809-49d3-ad0a-5ddace14e504', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', '11a6cb52-9af4-4c26-a747-be0d40adb538', 3, 40, 'seconds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('ad89241e-25e8-49df-a9f2-d8b90cb8407b', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', '674bd11b-5c55-4dfb-a1e1-04dee18d2074', 2, 40, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8e89598f-39b0-4c8b-afec-9d9a999391ca', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', 'e53d7b4d-d192-417f-a0af-e8539bbfe254', 2, 30, 'seconds', NULL, 15, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('88c5f24e-f26d-41d3-abca-3463fd53db54', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', '8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 3, 50, 'seconds', NULL, 15, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('268f9a19-9de5-4578-a18b-b5b0100cb2ff', '8dae8237-b59d-42f8-a1bc-8a7d7ff1c03d', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 180, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('d969143f-3f6b-44cb-a233-eff55d3e3ac4', 'WORKOUT_PLAN_YOGA_11', 'YOGA', 'Core & Thăng bằng nâng cao', 4, 11, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5b79b3bf-e053-4012-af64-112bcd3e3c75', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', 'b639f019-a2d6-4b14-aefc-bc91a0af6e85', 3, 30, 'seconds', NULL, 15, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('d64992c4-cd96-4af9-a7f8-383291a007b9', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', 'ea8ddaf4-63be-4f1c-a6e1-853ed1262cf3', 3, 30, 'seconds', NULL, 15, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('79b81808-4e43-4c8a-a0f7-bfd53339063d', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', 'e53d7b4d-d192-417f-a0af-e8539bbfe254', 3, 30, 'seconds', NULL, 15, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('031fbaca-ef85-4d4c-abf9-361f591a73f3', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', '97b39b03-e9e3-4fef-a490-f174668dd654', 2, 40, 'seconds', NULL, 15, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('5fbc85fd-b52d-4e58-a0cf-e1344af10384', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', '72ba0383-d5a3-4d9f-a6ca-b61b381eeb12', 3, 40, 'seconds', NULL, 15, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('b47901f9-b8d5-491e-ab68-c6f71709e202', 'd969143f-3f6b-44cb-a233-eff55d3e3ac4', '8c58af33-565d-4692-a409-39ccec02aa6f', 1, 60, 'seconds', NULL, 0, 6)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)
VALUES ('22ee9f3f-fed9-4bdc-a7ca-edd328d75671', 'WORKOUT_PLAN_YOGA_12', 'YOGA', 'Phục hồi sâu', 4, 12, 'Yoga 4 tuần: nền tảng → linh hoạt & tư thế đứng → sức mạnh & thăng bằng → nâng cao & phục hồi. reps = thời gian giữ (giây).')
ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('6d26760f-c16c-4645-a88d-cba26db361f5', '22ee9f3f-fed9-4bdc-a7ca-edd328d75671', 'e995314d-dbb0-4d30-a6b9-a0fd906ddab2', 1, 180, 'seconds', NULL, 0, 1)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('c84042ce-f952-4cf1-a2f4-468dc89d4480', '22ee9f3f-fed9-4bdc-a7ca-edd328d75671', '05cbc0b3-b510-4e3a-ac22-8911ac4b2089', 2, 60, 'seconds', NULL, 10, 2)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('60ea4bb2-6bf0-4124-a5e4-dcfba07fdd56', '22ee9f3f-fed9-4bdc-a7ca-edd328d75671', '0fc67e23-2fbb-46ed-aff1-dac8545eb722', 2, 60, 'seconds', NULL, 10, 3)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('8453cef7-7bb9-44df-a9e7-8b5fd36339ac', '22ee9f3f-fed9-4bdc-a7ca-edd328d75671', 'b4c2f974-f286-4110-a2d7-7bda13fda7b2', 1, 300, 'seconds', NULL, 0, 4)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)
VALUES ('0332fe5e-1a4a-4f72-af8e-0825851f4dc4', '22ee9f3f-fed9-4bdc-a7ca-edd328d75671', '10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 1, 300, 'seconds', NULL, 0, 5)
ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;

