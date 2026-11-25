require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Missing availability ID');
    process.exit(1);
  }

  await prisma.coachAvailability.update({
    where: { id },
    data: {
      startTime: new Date(Date.now() - 90 * 60 * 1000),
      endTime: new Date(Date.now() - 30 * 60 * 1000),
    },
  });
  console.log(`✓ Slot ${id} set to past session (1 hour ago).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

