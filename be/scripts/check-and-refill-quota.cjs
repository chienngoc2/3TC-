require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const member = await prisma.user.findUnique({
    where: { email: 'yoga-vip@seed.sportscenter.test' },
    include: {
      subscriptions: { include: { discipline: true } },
    },
  });

  console.log('Member:', member?.fullName);
  for (const sub of member?.subscriptions || []) {
    console.log(`Sub ${sub.id}: ${sub.discipline?.name}, Group: ${sub.remainingGroupSessions}, PT: ${sub.remainingPtSessions}, Status: ${sub.status}`);
    // Top up quota
    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: {
        remainingGroupSessions: 50,
        remainingPtSessions: 50,
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000), // 1 year in future
      },
    });
    console.log(`  -> Refilled to 50 group & 50 PT sessions, extended to 1 year.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
