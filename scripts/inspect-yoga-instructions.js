const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const exercises = await prisma.exerciseKnowledge.findMany({
    where: {
      category: { in: ['backbends_seated', 'flexibility_hips', 'core_flow', 'recovery_breath', 'standing_balance'] }
    },
    take: 10
  });

  exercises.forEach(e => {
    console.log(`\nTitle: ${e.title} (${e.category})`);
    console.log('instructions:', e.instructions);
  });
}

main().finally(() => prisma.$disconnect());
