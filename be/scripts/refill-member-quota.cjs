require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Missing userId');
    process.exit(1);
  }

  await prisma.userSubscription.updateMany({
    where: { userId },
    data: {
      remainingGroupSessions: 20,
      remainingPtSessions: 20,
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  });
  console.log(`✓ Refilled 20 group & 20 PT sessions for user ${userId}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
