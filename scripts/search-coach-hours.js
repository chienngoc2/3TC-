const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const coaches = await prisma.user.findMany({
    where: { role: 'COACH' },
    select: {
      id: true,
      email: true,
      fullName: true,
      coachProfile: {
        select: {
          workingDays: true,
          workingHours: true,
        }
      }
    }
  });

  for (const c of coaches) {
    const whStr = JSON.stringify(c.coachProfile?.workingHours);
    if (whStr && (whStr.includes('08:00') || whStr.includes('12:00'))) {
      console.log(`Coach ${c.fullName} (${c.email}):`);
      console.log(`  Days:`, c.coachProfile?.workingDays);
      console.log(`  Hours:`, whStr);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
