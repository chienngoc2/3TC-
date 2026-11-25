require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const badLockers = await prisma.$queryRawUnsafe(`
    SELECT l.id, l.locker_number, l.status, l.zone, la.id as assignment_id, la.user_id, la.returned_at
    FROM lockers l
    JOIN locker_assignments la ON l.id = la.locker_id
    WHERE l.status = 'AVAILABLE' AND la.returned_at IS NULL;
  `);
  console.log('Lockers with status AVAILABLE but active assignment:', badLockers);
}

main().catch(console.error).finally(() => prisma.$disconnect());
