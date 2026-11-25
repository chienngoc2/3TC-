const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const plans = await prisma.membershipPlan.findMany({
    select: {
      id: true,
      name: true,
      discipline: { select: { code: true, name: true } },
      curriculumTopics: true
    }
  });
  console.log('Membership plans and curriculum topics:', JSON.stringify(plans, null, 2));

  await prisma.$disconnect();
}

run().catch(console.error);
