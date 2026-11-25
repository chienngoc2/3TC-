const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePackageCategories() {
  console.log('--- Updating Membership Plans Package Categories & Inbody Topic ---');

  const plans = await prisma.membershipPlan.findMany({
    include: { discipline: true },
  });

  for (const plan of plans) {
    const discName = (plan.discipline?.name || '').toLowerCase();
    const isGym = discName.includes('gym') || discName.includes('fitness');
    const isGymVip = isGym && (plan.packageTier === 'VIP' || plan.name.toUpperCase().includes('VIP'));

    let category = null;
    let newCurriculum = plan.curriculumTopics;

    if (isGym) {
      if (isGymVip) {
        category = 'ONE_ON_ONE';
        // Rename InBody topic
        if (newCurriculum) {
          try {
            let topics = typeof newCurriculum === 'string' ? JSON.parse(newCurriculum) : newCurriculum;
            if (Array.isArray(topics)) {
              topics = topics.map((t) => {
                if (typeof t === 'string' && t.toLowerCase().includes('inbody')) {
                  return 'Đánh giá thể trạng & Hướng dẫn kỹ thuật động tác căn bản';
                }
                if (typeof t === 'object' && t !== null) {
                  const name = t.name || t.title || '';
                  if (name.toLowerCase().includes('inbody')) {
                    return {
                      ...t,
                      name: 'Đánh giá thể trạng & Hướng dẫn kỹ thuật động tác căn bản',
                      benefits: t.benefits || 'Đánh giá chỉ số cơ thể và hướng dẫn chi tiết các kỹ thuật động tác căn bản',
                    };
                  }
                }
                return t;
              });
              newCurriculum = topics;
            }
          } catch (e) {
            console.error('Error updating curriculum topics for', plan.name, e);
          }
        }
      } else {
        // Gym Trial, Gym Plus, Gym Drop-in => null
        category = null;
      }
    } else {
      // All Yoga & Boxing plans => 'GROUP'
      category = 'GROUP';
    }

    await prisma.membershipPlan.update({
      where: { id: plan.id },
      data: {
        packageCategory: category,
        curriculumTopics: newCurriculum,
      },
    });

    console.log(`Plan [${plan.name}] (${plan.discipline?.name}) -> category: ${category}`);
  }

  // Sync to UserSubscriptions
  console.log('--- Syncing packageCategory to UserSubscriptions ---');
  const subs = await prisma.userSubscription.findMany({
    include: { plan: true },
  });

  for (const sub of subs) {
    const targetCategory = sub.plan?.packageCategory || null;
    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { packageCategory: targetCategory },
    });
  }
  console.log(`Synced ${subs.length} user subscriptions.`);

  console.log('Finished successfully.');
}

updatePackageCategories()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
