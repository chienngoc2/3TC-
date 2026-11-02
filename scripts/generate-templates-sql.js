const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function seedId(...parts) {
  const hex = crypto
    .createHash('sha256')
    .update('sportscenter-seed:' + parts.join(':'))
    .digest('hex');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-4' +
    hex.slice(13, 16) +
    '-a' +
    hex.slice(17, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

const programsPath = path.join(__dirname, '../prisma/data/programs_catalog.json');
const programs = JSON.parse(fs.readFileSync(programsPath, 'utf8'));

let sql = `-- ==============================================================================
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
`;

let totalTemplates = 0;
let totalExercises = 0;

for (const prog of programs) {
  const discipline = prog.discipline;
  sql += `\n-- ------------------------------------------------------------------------------\n`;
  sql += `-- CHƯƠNG TRÌNH: ${discipline} (12 BUỔI)\n`;
  sql += `-- ------------------------------------------------------------------------------\n\n`;

  for (const wp of prog.workout_plans) {
    const templateId = seedId('template', wp.workout_plan_id);
    const code = wp.workout_plan_id;
    const title = wp.title.replace(/'/g, "''");
    const desc = (prog.description || '').replace(/'/g, "''");

    sql += `INSERT INTO workout_templates (id, template_code, discipline_code, title, week_number, session_order, description)\n`;
    sql += `VALUES ('${templateId}', '${code}', '${discipline}', '${title}', ${wp.week}, ${wp.session_order}, '${desc}')\n`;
    sql += `ON CONFLICT (template_code) DO UPDATE SET title = EXCLUDED.title, week_number = EXCLUDED.week_number, session_order = EXCLUDED.session_order, description = EXCLUDED.description;\n\n`;
    totalTemplates++;

    for (const ex of wp.exercises) {
      const exTemplateId = seedId('template_ex', wp.workout_plan_id, String(ex.order_index));
      const exerciseKnowledgeId = seedId('exercise', ex.exercise_id);
      const sets = ex.sets !== null && ex.sets !== undefined ? ex.sets : 'NULL';
      const reps = ex.reps !== null && ex.reps !== undefined ? ex.reps : 'NULL';
      const unit = `'${ex.unit || 'reps'}'`;
      const weight = ex.weight_kg !== null && ex.weight_kg !== undefined ? ex.weight_kg : 'NULL';
      const rest = ex.rest_seconds !== null && ex.rest_seconds !== undefined ? ex.rest_seconds : 'NULL';

      sql += `INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, unit, weight_kg, rest_seconds, order_index)\n`;
      sql += `VALUES ('${exTemplateId}', '${templateId}', '${exerciseKnowledgeId}', ${sets}, ${reps}, ${unit}, ${weight}, ${rest}, ${ex.order_index})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET sets = EXCLUDED.sets, reps = EXCLUDED.reps, unit = EXCLUDED.unit, weight_kg = EXCLUDED.weight_kg, rest_seconds = EXCLUDED.rest_seconds, order_index = EXCLUDED.order_index;\n\n`;
      totalExercises++;
    }
  }
}

const outPath = path.join(__dirname, '../prisma/data/seed_workout_templates.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated SQL successfully! Total templates: ${totalTemplates}, Total exercises: ${totalExercises}`);
