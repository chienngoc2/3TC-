require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Missing schedule ID');
    process.exit(1);
  }

  await prisma.schedule.update({
    where: { id },
    data: {
      startTime: new Date(Date.now() - 3 * 3600 * 1000),
      endTime: new Date(Date.now() - 2 * 3600 * 1000),
    },
  });
  console.log(`✓ Schedule ${id} set to completed/past session (3 hours ago).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
