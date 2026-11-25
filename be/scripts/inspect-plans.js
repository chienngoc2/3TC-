const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.membershipPlan.findMany({
    include: {
      discipline: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Total plans:', plans.length);
  for (const p of plans) {
    console.log({
      id: p.id,
      name: p.name,
      discipline: p.discipline?.name,
      packageTier: p.packageTier,
      trainingMode: p.trainingMode,
      ptQuota: p.ptSessionQuota,
      groupQuota: p.groupSessionQuota,
      curriculumTopics: p.curriculumTopics ? JSON.stringify(p.curriculumTopics).substring(0, 100) : null,
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
