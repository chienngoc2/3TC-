import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const yoga = await db.discipline.findFirst({ where: { code: 'YOGA' } });
  const boxing = await db.discipline.findFirst({ where: { code: 'BOXING' } });

  // Deactivate all Yoga & Boxing plans except the main 12-session group class plans
  await db.membershipPlan.updateMany({
    where: {
      disciplineId: { in: [yoga!.id, boxing!.id] },
      name: { notIn: [
        'Khóa Học Yoga Chuyên Đề Toàn Diện (12 Buổi / Tháng)',
        'Khóa Học Boxing & Kickboxing Thể Lực (12 Buổi / Tháng)',
      ]},
    },
    data: { isActive: false },
  });

  const active = await db.membershipPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true, packageTier: true },
  });
  console.log('Final Active Plans in Catalog:');
  console.table(active);
  await db.$disconnect();
}

main().catch(console.error);
