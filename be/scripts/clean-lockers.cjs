const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const member = await prisma.user.findUnique({
    where: { email: 'yoga-vip@seed.sportscenter.test' },
    include: {
      lockerAssignments: {
        where: { returnedAt: null },
        include: { locker: true },
      },
    },
  });

  console.log('Member:', member?.fullName, member?.id);
  console.log('Active locker assignments:', member?.lockerAssignments.length);

  if (member?.lockerAssignments.length) {
    for (const la of member.lockerAssignments) {
      await prisma.lockerAssignment.update({
        where: { id: la.id },
        data: { returnedAt: new Date() },
      });
      await prisma.locker.update({
        where: { id: la.lockerId },
        data: { status: 'AVAILABLE' },
      });
      console.log(`✓ Returned locker ${la.locker?.lockerNumber} (Assignment ID: ${la.id})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

