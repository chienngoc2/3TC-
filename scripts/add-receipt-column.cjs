require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE coach_payouts 
    ADD COLUMN IF NOT EXISTS receipt_url TEXT;
  `);
  console.log('✓ Added receipt_url column to coach_payouts table.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
