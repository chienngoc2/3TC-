import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('=== REDUCING ALL PLAN PRICES TO 10% ===');
  const plans = await prisma.membershipPlan.findMany({
    include: { discipline: true },
  });

  for (const plan of plans) {
    const oldPrice = Number(plan.price);
    if (plan.packageTier === 'TRIAL' || oldPrice === 0) {
      console.log(`- Plan [${plan.discipline?.code}] ${plan.name} (${plan.packageTier}): Price is 0 VND (TRIAL), keeping 0.`);
      continue;
    }

    // 10% of current price, rounded to nearest 1,000 VND
    const newPrice = Math.max(1000, Math.round((oldPrice * 0.1) / 1000) * 1000);
    await prisma.membershipPlan.update({
      where: { id: plan.id },
      data: { price: newPrice },
    });
    console.log(`- Plan [${plan.discipline?.code}] ${plan.name} (${plan.packageTier}): ${oldPrice.toLocaleString('vi-VN')} đ -> ${newPrice.toLocaleString('vi-VN')} đ (Giảm còn 10%)`);
  }

  console.log('=== ALL PLANS UPDATED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
