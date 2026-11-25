require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Return the stale assignments from earlier seed/tests
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE locker_assignments 
    SET returned_at = NOW() 
    WHERE returned_at IS NULL AND assigned_at < NOW() - INTERVAL '1 day';
  `);
  console.log(`✓ Cleaned up ${updated} stale overnight locker assignments.`);

  // Sync locker status
  await prisma.$executeRawUnsafe(`
    UPDATE lockers 
    SET status = 'AVAILABLE' 
    WHERE id NOT IN (SELECT locker_id FROM locker_assignments WHERE returned_at IS NULL);
  `);
  console.log('✓ Synced available lockers.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
