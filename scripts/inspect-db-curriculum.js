const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const exercises = await prisma.exerciseKnowledge.findMany({
    select: { id: true, title: true, category: true, instructions: true }
  });
  console.log('Total ExerciseKnowledge:', exercises.length);
  exercises.forEach(e => {
    console.log(`- [${e.category}] ${e.title}`);
  });

  const templates = await prisma.workoutTemplate.findMany({
    include: {
      exercises: {
        include: { exercise: true }
      }
    }
  });
  console.log('\nTotal WorkoutTemplate:', templates.length);
  templates.forEach(t => {
    console.log(`\nTemplate: [${t.templateCode}] ${t.title} (${t.disciplineCode}, W${t.weekNumber}-S${t.sessionOrder})`);
    t.exercises.forEach(te => {
      console.log(`  -> ${te.exercise?.title} (order: ${te.orderIndex}, sets: ${te.sets}, reps: ${te.reps})`);
    });
  });

  const plans = await prisma.membershipPlan.findMany({
    select: {
      id: true,
      name: true,
      curriculumTopics: true,
      recommendedRoadmap: true,
      weeklySchedulePreview: true,
      packageCategory: true
    }
  });
  console.log('\nPlans in DB:');
  plans.forEach(p => {
    console.log(`\nPlan: ${p.name} (${p.id}) [${p.packageCategory}]`);
    console.log('curriculumTopics:', JSON.stringify(p.curriculumTopics, null, 2));
    console.log('recommendedRoadmap:', JSON.stringify(p.recommendedRoadmap, null, 2));
  });
}

main().finally(() => prisma.$disconnect());
