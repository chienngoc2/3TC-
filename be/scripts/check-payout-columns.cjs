require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'coach_payouts'
    ORDER BY ordinal_position;
  `);
  console.log('Columns:', cols.map(c => c.column_name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
