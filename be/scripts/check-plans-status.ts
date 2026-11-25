import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      packageTier: true,
      trainingMode: true,
      curriculumTopics: true,
    },
  });
  console.log('Active plans in DB:');
  for (const p of plans) {
    console.log(`- ${p.name} (${p.packageTier}) Topics:`, p.curriculumTopics ? 'YES' : 'NO');
  }

  const classes = await db.class.findMany({ select: { id: true, name: true } });
  console.log(`Classes in DB (${classes.length}):`, classes.map((c) => c.name));

  const shiftsCount = await db.staffShift.count();
  const slotsCount = await db.coachAvailability.count();
  console.log(`Shifts count: ${shiftsCount}, Availability slots count: ${slotsCount}`);

  await db.$disconnect();
}

main().catch(console.error);
