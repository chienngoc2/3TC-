-- SEED DATA FOR EXERCISE_KNOWLEDGE (SUPABASE)
-- Generated for 84 exercises in Gym, Boxing, Yoga

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('1f44548d-1e9b-44b1-a415-61ff8be2d318', 'Squat (Barbell Back Squat)', 'strength', '[Code: EXERCISE_SQUAT] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ccbeee77-5886-4552-a839-c6221758491d', 'Đẩy ngực ghế phẳng (Barbell Bench Press)', 'strength', '[Code: EXERCISE_BENCH_PRESS] [Môn: GYM] [Nhóm cơ: chest] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('1e7f68c4-956e-4fcd-a0b9-02099df7e41a', 'Kéo xô (Lat Pulldown)', 'strength', '[Code: EXERCISE_LAT_PULLDOWN] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: cable_machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('8c1b183f-d2f5-4b6f-a1c3-b45d2de4f471', 'Plank (Plank)', 'core', '[Code: EXERCISE_PLANK] [Môn: GYM] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e0c8db4b-ed84-4fad-ac8e-6e7393ae5202', 'Máy chạy bộ (Treadmill)', 'cardio', '[Code: EXERCISE_TREADMILL] [Môn: GYM] [Nhóm cơ: full_body] [Thiết bị: treadmill] [Đơn vị: minutes]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('47904c15-0f11-414d-ab42-c05406726659', 'Mountain climber (Mountain Climber)', 'cardio', '[Code: EXERCISE_MOUNTAIN_CLIMBER] [Môn: GYM] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('2aa9de4d-6976-488a-a48d-1092199c5a03', 'Gập bụng xe đạp (Bicycle Crunch)', 'core', '[Code: EXERCISE_BICYCLE_CRUNCH] [Môn: GYM] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('a9dc4bff-0038-40c3-af4b-281b77c5875a', 'Đạp đùi (Leg Press)', 'strength', '[Code: EXERCISE_LEG_PRESS] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('718b4ec7-3684-4ad8-ae2b-144bd9108054', 'Đẩy ngực tạ đơn (Dumbbell Bench Press)', 'strength', '[Code: EXERCISE_DUMBBELL_BENCH_PRESS] [Môn: GYM] [Nhóm cơ: chest] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('223c7b48-d006-4f2e-af74-1804a8f1f811', 'Kéo cáp ngồi (Seated Cable Row)', 'strength', '[Code: EXERCISE_SEATED_CABLE_ROW] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: cable_machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e77919e5-0bf1-41f8-a365-594bf6f3ca22', 'Cuốn tạ đơn tay trước (Dumbbell Curl)', 'strength', '[Code: EXERCISE_DUMBBELL_CURL] [Môn: GYM] [Nhóm cơ: biceps] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('7a07ad4c-2994-4fc2-a5dc-00fb3b81047e', 'Goblet squat (Goblet Squat)', 'strength', '[Code: EXERCISE_GOBLET_SQUAT] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('961d1506-6d1b-4df3-ac09-482311e95b7f', 'Bulgarian split squat (Bulgarian Split Squat)', 'strength', '[Code: EXERCISE_BULGARIAN_SPLIT_SQUAT] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ecaf32a3-538c-4636-ad6a-77485ff9e149', 'Gập đùi sau (Leg Curl)', 'strength', '[Code: EXERCISE_LEG_CURL] [Môn: GYM] [Nhóm cơ: hamstrings] [Thiết bị: machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('6e626d01-a39e-4438-a86e-c7e3654dc01f', 'Đẩy ngực trên tạ đơn (Incline Dumbbell Press)', 'strength', '[Code: EXERCISE_INCLINE_DUMBBELL_PRESS] [Môn: GYM] [Nhóm cơ: upper_chest] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('eafdd78c-7126-41c2-a163-632f3411928f', 'Đẩy vai (Shoulder Press)', 'strength', '[Code: EXERCISE_SHOULDER_PRESS] [Môn: GYM] [Nhóm cơ: shoulders] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('874d1f29-b910-4def-a921-25e4c55d74ba', 'Nâng tạ đơn ngang (vai giữa) (Lateral Raise)', 'strength', '[Code: EXERCISE_LATERAL_RAISE] [Môn: GYM] [Nhóm cơ: shoulders] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('44fbf32d-5b27-4570-ae8a-d9f9efe15741', 'Đẩy cáp tay sau (Tricep Pushdown)', 'strength', '[Code: EXERCISE_TRICEP_PUSHDOWN] [Môn: GYM] [Nhóm cơ: triceps] [Thiết bị: cable_machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('26f091fd-0704-4fe8-aecd-2dd630f70bba', 'Jumping jack (Jumping Jack)', 'cardio', '[Code: EXERCISE_JUMPING_JACK] [Môn: GYM] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('f7a8ac28-2a6d-47f3-ace8-9652d932a628', 'Xoay người kiểu Nga (Russian Twist)', 'core', '[Code: EXERCISE_RUSSIAN_TWIST] [Môn: GYM] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e095bd93-014e-4783-aa2c-714042c6a9c9', 'Hip thrust (Hip Thrust)', 'strength', '[Code: EXERCISE_HIP_THRUST] [Môn: GYM] [Nhóm cơ: glutes] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('9d837ee6-3c32-4241-a028-67d8a499b882', 'Lunge (Lunges)', 'strength', '[Code: EXERCISE_LUNGES] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('49adc049-a696-4884-afbe-5b3749ba51f2', 'Nhón bắp chân (Calf Raise)', 'strength', '[Code: EXERCISE_CALF_RAISE] [Môn: GYM] [Nhóm cơ: calves] [Thiết bị: machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('04dbb577-da95-4609-a21b-4c1ca55da30a', 'Romanian deadlift (Romanian Deadlift)', 'strength', '[Code: EXERCISE_ROMANIAN_DEADLIFT] [Môn: GYM] [Nhóm cơ: hamstrings] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('f2b42a97-09ae-4a7e-af6b-773da5eb526b', 'Kéo tạ đòn (Barbell Row)', 'strength', '[Code: EXERCISE_BARBELL_ROW] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('b3f7d1a3-2833-49b3-afef-32dbfd95e6f0', 'Đẩy ngực trên tạ đòn (Incline Bench Press)', 'strength', '[Code: EXERCISE_INCLINE_BENCH_PRESS] [Môn: GYM] [Nhóm cơ: upper_chest] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('f46dd005-fcce-429f-a4d3-2519c08d67a0', 'Ép ngực cáp (Cable Fly)', 'strength', '[Code: EXERCISE_CABLE_FLY] [Môn: GYM] [Nhóm cơ: chest] [Thiết bị: cable_machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ddfd31bf-c75a-40c4-afa9-6295dec93ac1', 'Duỗi tay sau qua đầu (Overhead Tricep Extension)', 'strength', '[Code: EXERCISE_OVERHEAD_TRICEP_EXTENSION] [Môn: GYM] [Nhóm cơ: triceps] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('0d5f3c01-c1c7-4b26-a6ff-455b3aad5ef7', 'Front squat (Front Squat)', 'strength', '[Code: EXERCISE_FRONT_SQUAT] [Môn: GYM] [Nhóm cơ: quads] [Thiết bị: barbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('4c5d7265-dbc2-4e81-a59e-e6e6f2a040ab', 'Đá đùi trước (Leg Extension)', 'strength', '[Code: EXERCISE_LEG_EXTENSION] [Môn: GYM] [Nhóm cơ: quads] [Thiết bị: machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e14a481d-5c3b-4c34-a25b-1d5e1b376a96', 'Hít xà (Pull Up)', 'strength', '[Code: EXERCISE_PULL_UP] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: pull_up_bar] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('55189424-68c8-41f0-a823-91003730c7b1', 'Kéo tạ có tựa ngực (Chest Supported Row)', 'strength', '[Code: EXERCISE_CHEST_SUPPORTED_ROW] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('0a10043f-8acc-4495-a65d-c3000b9a1b63', 'Cuốn tạ đơn kiểu búa (Hammer Curl)', 'strength', '[Code: EXERCISE_HAMMER_CURL] [Môn: GYM] [Nhóm cơ: biceps] [Thiết bị: dumbbell] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ea8a1a15-bcdc-47f6-aa88-686b05b2f152', 'Hít xà có hỗ trợ (Assisted Pull Up)', 'strength', '[Code: EXERCISE_ASSISTED_PULL_UP] [Môn: GYM] [Nhóm cơ: back] [Thiết bị: assist_machine] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('6c54d008-bf94-4af5-ae76-40d25a766aa9', 'Hít đất (Push Up)', 'strength', '[Code: EXERCISE_PUSH_UP] [Môn: GYM] [Nhóm cơ: chest] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('bf99dce6-e5c9-4862-abe2-bccae8a15f9a', 'Khởi động động (Dynamic Warm-up)', 'warmup', '[Code: EXERCISE_DYNAMIC_WARMUP] [Môn: GYM] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: minutes]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('53aa978d-7e8b-45a8-a2d1-977d6f047334', 'Giãn cơ tĩnh (Static Stretch)', 'cooldown', '[Code: EXERCISE_STATIC_STRETCH] [Môn: GYM] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: minutes]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('bcafc5f9-67fa-47a9-aed6-ab5fd9463554', 'Nhảy dây (Jump Rope)', 'cardio', '[Code: EXERCISE_JUMP_ROPE] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: jump_rope] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('f8ad2caf-1f48-449c-a7c5-7e5f79aeef0c', 'Tư thế & di chuyển chân (Boxing Stance & Footwork)', 'technique', '[Code: EXERCISE_BOXING_STANCE_FOOTWORK] [Môn: BOXING] [Nhóm cơ: legs] [Thiết bị: bodyweight] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('0ecc0d8a-6395-4da0-ac2a-5150bcdf50ba', 'Đấm gió (Shadow Boxing)', 'technique', '[Code: EXERCISE_SHADOW_BOXING] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('922de3d3-28c6-4d8a-af16-1ab2eb78243a', 'Jab – Cross (Jab-Cross Drill)', 'technique', '[Code: EXERCISE_JAB_CROSS_DRILL] [Môn: BOXING] [Nhóm cơ: shoulders] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('1a2ae86d-cb64-4f21-a590-8acb5d930641', 'Móc (Hook) (Hook Drill)', 'technique', '[Code: EXERCISE_HOOK_DRILL] [Môn: BOXING] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('7e07ecd1-2551-43ab-a78a-a3976fcb09af', 'Móc ngược (Uppercut) (Uppercut Drill)', 'technique', '[Code: EXERCISE_UPPERCUT_DRILL] [Môn: BOXING] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('aeeccb4e-487b-40f7-ae3f-25d7500f6d43', 'Combo Jab – Cross – Hook (Jab-Cross-Hook Combo)', 'technique', '[Code: EXERCISE_COMBO_JAB_CROSS_HOOK] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('cf4e8179-2f69-4d3a-a102-a3395af6b481', 'Combo 4-5 đòn (Advanced Combo (4-5 punches))', 'technique', '[Code: EXERCISE_COMBO_ADVANCED] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('8b90385c-77aa-4f9c-aa69-768b3a82aff8', 'Né – Cúi – Lách (Slip, Bob & Weave)', 'technique', '[Code: EXERCISE_SLIP_BOB_WEAVE] [Môn: BOXING] [Nhóm cơ: core] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('40669037-e7aa-4539-afdf-58f10159a41a', 'Đỡ & gạt đòn (Block & Parry)', 'technique', '[Code: EXERCISE_BLOCK_PARRY] [Môn: BOXING] [Nhóm cơ: arms] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('cb173f59-bd09-4b2f-aa69-a3b2bfc409f1', 'Phản đòn (Counter Punch Drill)', 'technique', '[Code: EXERCISE_COUNTER_PUNCH_DRILL] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: focus_mitts] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('69b11ef5-85bf-4b28-af7f-b18792e64626', 'Đấm bao nặng (Heavy Bag Rounds)', 'cardio', '[Code: EXERCISE_HEAVY_BAG] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: heavy_bag] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('68a3b619-81f1-41d9-a5d6-bfeed5a26479', 'Đấm bia (pad work) (Focus Mitt Rounds)', 'technique', '[Code: EXERCISE_FOCUS_MITT] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: focus_mitts] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('92daa886-0f91-41c2-a288-8a137e8c37b4', 'Burpee (Burpee)', 'cardio', '[Code: EXERCISE_BURPEE] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: bodyweight] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ceb9de0d-d646-49a7-ab3b-87ef4bd4e29d', 'Đập bóng tạ (Medicine Ball Slam)', 'power', '[Code: EXERCISE_MEDICINE_BALL_SLAM] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: medicine_ball] [Đơn vị: reps]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('542351a9-d635-4c89-a636-87c2aad23d24', 'Sparring nhẹ (có HLV) (Light Sparring (coach supervised))', 'sparring', '[Code: EXERCISE_SPARRING_LIGHT] [Môn: BOXING] [Nhóm cơ: full_body] [Thiết bị: gloves_headgear] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e995314d-dbb0-4d30-a6b9-a0fd906ddab2', 'Thở bụng (Diaphragmatic Breathing)', 'recovery', '[Code: EXERCISE_DIAPHRAGMATIC_BREATHING] [Môn: YOGA] [Nhóm cơ: breath] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('6e41d48d-0ae9-497f-a208-78413792afca', 'Mèo – Bò (Cat-Cow)', 'yoga_pose', '[Code: EXERCISE_CAT_COW] [Môn: YOGA] [Nhóm cơ: spine] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('2e88a567-f76e-4afc-a378-4d1da0266fc0', 'Chó úp mặt (Downward-Facing Dog)', 'yoga_pose', '[Code: EXERCISE_DOWNWARD_DOG] [Môn: YOGA] [Nhóm cơ: full_body] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('8c58af33-565d-4692-a409-39ccec02aa6f', 'Tư thế em bé (Child''s Pose)', 'yoga_pose', '[Code: EXERCISE_CHILD_POSE] [Môn: YOGA] [Nhóm cơ: back] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e98a81f3-d5a4-484e-a377-671f3291ced8', 'Rắn hổ mang (Cobra Pose)', 'yoga_pose', '[Code: EXERCISE_COBRA] [Môn: YOGA] [Nhóm cơ: back] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('10f1a6b7-14d5-4c0d-a44e-fac4322f7468', 'Thả lỏng (Savasana) (Savasana)', 'recovery', '[Code: EXERCISE_SAVASANA] [Môn: YOGA] [Nhóm cơ: relax] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('2f100ac8-26c3-4d81-ad39-c19027b9a3e9', 'Tư thế núi (Mountain Pose)', 'yoga_pose', '[Code: EXERCISE_MOUNTAIN_POSE] [Môn: YOGA] [Nhóm cơ: full_body] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('f26dd04d-c8d5-4b5d-af38-8b2e4f1b4075', 'Chào mặt trời A (Sun Salutation A)', 'yoga_pose', '[Code: EXERCISE_SUN_SALUTATION_A] [Môn: YOGA] [Nhóm cơ: full_body] [Thiết bị: yoga_mat] [Đơn vị: rounds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('6e0c4f7a-ab1c-4a47-ae69-e006d3622d86', 'Chào mặt trời B (Sun Salutation B)', 'yoga_pose', '[Code: EXERCISE_SUN_SALUTATION_B] [Môn: YOGA] [Nhóm cơ: full_body] [Thiết bị: yoga_mat] [Đơn vị: rounds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('121d0d1e-9cc7-4dc9-ad15-ca22f079161a', 'Lunge thấp (Low Lunge)', 'yoga_pose', '[Code: EXERCISE_LOW_LUNGE] [Môn: YOGA] [Nhóm cơ: hips] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('d0212daa-a1fb-4683-a89a-452086252feb', 'Gập người ngồi (Seated Forward Fold)', 'yoga_pose', '[Code: EXERCISE_SEATED_FORWARD_FOLD] [Môn: YOGA] [Nhóm cơ: hamstrings] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('da86160b-2e2f-4f84-a4d0-a3a2e66c7b3f', 'Tư thế chim bồ câu (Pigeon Pose)', 'yoga_pose', '[Code: EXERCISE_PIGEON_POSE] [Môn: YOGA] [Nhóm cơ: hips] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('05cbc0b3-b510-4e3a-ac22-8911ac4b2089', 'Em bé vui vẻ (Happy Baby)', 'yoga_pose', '[Code: EXERCISE_HAPPY_BABY] [Môn: YOGA] [Nhóm cơ: hips] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('674bd11b-5c55-4dfb-a1e1-04dee18d2074', 'Chiến binh I (Warrior I)', 'yoga_pose', '[Code: EXERCISE_WARRIOR_I] [Môn: YOGA] [Nhóm cơ: legs] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('75c8538b-ba2f-41a8-a9a3-c045c5d03bab', 'Chiến binh II (Warrior II)', 'yoga_pose', '[Code: EXERCISE_WARRIOR_II] [Môn: YOGA] [Nhóm cơ: legs] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('e53d7b4d-d192-417f-a0af-e8539bbfe254', 'Chiến binh III (Warrior III)', 'yoga_pose', '[Code: EXERCISE_WARRIOR_III] [Môn: YOGA] [Nhóm cơ: balance] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('1b83045e-12a3-4dc8-a969-b90be2c2b880', 'Tam giác (Triangle Pose)', 'yoga_pose', '[Code: EXERCISE_TRIANGLE_POSE] [Môn: YOGA] [Nhóm cơ: legs] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('8336a70c-3094-473f-a65b-09b80e12e60d', 'Cây (Tree Pose)', 'yoga_pose', '[Code: EXERCISE_TREE_POSE] [Môn: YOGA] [Nhóm cơ: balance] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('97b39b03-e9e3-4fef-a490-f174668dd654', 'Nửa vầng trăng (Half Moon Pose)', 'yoga_pose', '[Code: EXERCISE_HALF_MOON] [Môn: YOGA] [Nhóm cơ: balance] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('7d99f6a8-0d72-4b8b-acea-8d8264c04324', 'Đại bàng (Eagle Pose)', 'yoga_pose', '[Code: EXERCISE_EAGLE_POSE] [Môn: YOGA] [Nhóm cơ: balance] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('11a6cb52-9af4-4c26-a747-be0d40adb538', 'Cái ghế (Chair Pose)', 'yoga_pose', '[Code: EXERCISE_CHAIR_POSE] [Môn: YOGA] [Nhóm cơ: legs] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('b639f019-a2d6-4b14-aefc-bc91a0af6e85', 'Con thuyền (Boat Pose)', 'yoga_pose', '[Code: EXERCISE_BOAT_POSE] [Môn: YOGA] [Nhóm cơ: core] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('72ba0383-d5a3-4d9f-a6ca-b61b381eeb12', 'Cây cầu (Bridge Pose)', 'yoga_pose', '[Code: EXERCISE_BRIDGE_POSE] [Môn: YOGA] [Nhóm cơ: glutes] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('ea8ddaf4-63be-4f1c-a6e1-853ed1262cf3', 'Plank nghiêng (Side Plank)', 'yoga_pose', '[Code: EXERCISE_SIDE_PLANK] [Môn: YOGA] [Nhóm cơ: core] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('b7c1eeac-2315-43ba-aa91-8584a72737af', 'Xoay người ngồi (Seated Twist)', 'yoga_pose', '[Code: EXERCISE_SEATED_TWIST] [Môn: YOGA] [Nhóm cơ: spine] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('0fc67e23-2fbb-46ed-aff1-dac8545eb722', 'Xoay người nằm (Supine Twist)', 'yoga_pose', '[Code: EXERCISE_SUPINE_TWIST] [Môn: YOGA] [Nhóm cơ: spine] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('1af66afa-f28f-4db0-a63a-dd052edf9e1f', 'Xỏ kim (Thread the Needle)', 'yoga_pose', '[Code: EXERCISE_THREAD_THE_NEEDLE] [Môn: YOGA] [Nhóm cơ: shoulders] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('b6a15f77-195a-4fed-ae76-b7d758eabedd', 'Thằn lằn (Lizard Pose)', 'yoga_pose', '[Code: EXERCISE_LIZARD_POSE] [Môn: YOGA] [Nhóm cơ: hips] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('9efa03e0-52ee-49f5-a887-f6178dd193dd', 'Squat yoga (Malasana) (Garland Pose)', 'yoga_pose', '[Code: EXERCISE_GARLAND_POSE] [Môn: YOGA] [Nhóm cơ: hips] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('9e97c598-3644-4eec-a5e7-ecc803b6ded8', 'Lạc đà (Camel Pose)', 'yoga_pose', '[Code: EXERCISE_CAMEL_POSE] [Môn: YOGA] [Nhóm cơ: back] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

INSERT INTO exercise_knowledge (id, title, category, instructions)
VALUES ('b4c2f974-f286-4110-a2d7-7bda13fda7b2', 'Gác chân lên tường (Legs Up the Wall)', 'recovery', '[Code: EXERCISE_LEGS_UP_WALL] [Môn: YOGA] [Nhóm cơ: relax] [Thiết bị: yoga_mat] [Đơn vị: seconds]')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, instructions = EXCLUDED.instructions;

