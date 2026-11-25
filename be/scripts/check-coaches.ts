import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coaches = await prisma.user.findMany({
    where: { role: 'COACH' },
    select: {
      id: true,
      fullName: true,
      coachProfile: {
        select: {
          ratingStars: true,
          ratePerSession: true,
        },
      },
      coachRates: {
        select: {
          id: true,
          ratePerSession: true,
        },
      },
    },
  });

  for (const c of coaches) {
    console.log(
      `Coach: ${c.fullName} | Stars: ${c.coachProfile?.ratingStars} | ProfileRate: ${c.coachProfile?.ratePerSession} | Rates: ${JSON.stringify(c.coachRates.map(r => Number(r.ratePerSession)))}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
