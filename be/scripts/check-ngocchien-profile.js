const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const coach = await prisma.user.findFirst({
    where: { email: 'ngocchien8821@gmail.com' },
    include: { coachProfile: true }
  });
  console.log('Coach ID:', coach?.id);
  console.log('workingDays:', coach?.coachProfile?.workingDays);
  console.log('workingHours:', JSON.stringify(coach?.coachProfile?.workingHours, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
