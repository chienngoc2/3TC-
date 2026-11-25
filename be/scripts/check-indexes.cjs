require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'locker_assignments';
  `);
  console.log('Indexes on locker_assignments:', indexes);

  const assignments = await prisma.lockerAssignment.findMany({
    take: 10,
    select: { id: true, lockerId: true, userId: true, returnedAt: true }
  });
  console.log('Existing locker assignments:', assignments);
}

main().catch(console.error).finally(() => prisma.$disconnect());
