const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to Supabase PostgreSQL database...');

  const sqlStatements = [
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS body_fat_mass_kg NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS lean_body_mass_kg NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS skeletal_muscle_mass_kg NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS tbw_liters NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS protein_kg NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS mineral_kg NUMERIC(5,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS bmr_kcal INTEGER;`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS waist_hip_ratio NUMERIC(4,2);`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS inbody_score INTEGER;`,
    `ALTER TABLE member_inbody_logs ADD COLUMN IF NOT EXISTS segmental_lean JSONB DEFAULT '{"rightArm":null,"leftArm":null,"trunk":null,"rightLeg":null,"leftLeg":null}'::jsonb;`,
  ];

  for (const sql of sqlStatements) {
    console.log(`Executing: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'member_inbody_logs'
    ORDER BY ordinal_position;
  `);

  console.log('Successfully applied migration! Updated columns in member_inbody_logs:');
  console.table(columns);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
