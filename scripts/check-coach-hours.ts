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
          id: true,
          workingDays: true,
          workingHours: true,
        },
      },
    },
  });

  for (const c of coaches) {
    console.log(
      `${c.fullName} -> Days: ${JSON.stringify(c.coachProfile?.workingDays)} | Hours: ${JSON.stringify(c.coachProfile?.workingHours)}`
    );
  }
}

main().finally(() => prisma.$disconnect());
