import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.membershipPlan.findMany({
    select: {
      id: true,
      name: true,
      packageTier: true,
      price: true,
      discipline: { select: { code: true, name: true } },
    },
    orderBy: { price: 'asc' },
  });
  console.log(`Found ${plans.length} plans:`);
  for (const p of plans) {
    console.log(`- [${p.discipline?.code}] ${p.name} (${p.packageTier}): ${Number(p.price).toLocaleString('vi-VN')} đ (ID: ${p.id})`);
  }
}

main().finally(() => prisma.$disconnect());
