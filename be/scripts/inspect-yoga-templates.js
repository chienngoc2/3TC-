const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.workoutTemplate.findMany({
    where: {
      OR: [
        { disciplineCode: { contains: 'YOGA', mode: 'insensitive' } },
        { title: { contains: 'Yoga', mode: 'insensitive' } },
        { title: { contains: 'Cột sống', mode: 'insensitive' } },
        { title: { contains: 'Trị liệu', mode: 'insensitive' } },
      ]
    },
    include: {
      exercises: {
        include: { exercise: true }
      }
    }
  });

  console.log('Yoga WorkoutTemplates:', templates.length);
  templates.forEach(t => {
    console.log(`\nTemplate: [${t.templateCode}] ${t.title} (${t.disciplineCode}, W${t.weekNumber}-S${t.sessionOrder})`);
    t.exercises.forEach(te => {
      console.log(`  -> ${te.exercise?.title} (order: ${te.orderIndex}, sets: ${te.sets}, reps: ${te.reps})`);
    });
  });
}

main().finally(() => prisma.$disconnect());
