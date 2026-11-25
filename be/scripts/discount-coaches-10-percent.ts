import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ĐANG GIẢM GIÁ COACH XUỐNG CÒN 10% HIỆN TẠI (1 SAO = 1.000 Đ) ---');

  // 1. Cập nhật bảng coachProfile
  const profiles = await prisma.coachProfile.findMany();
  for (const p of profiles) {
    const currentRate = Number(p.ratePerSession) || 30000;
    const newRate = Math.max(1000, Math.round(currentRate * 0.1));
    await prisma.coachProfile.update({
      where: { id: p.id },
      data: { ratePerSession: newRate },
    });
    console.log(`Updated CoachProfile ID ${p.id} (${p.ratingStars} sao): ${currentRate} -> ${newRate}`);
  }

  // 2. Cập nhật bảng coachRate
  const rates = await prisma.coachRate.findMany();
  for (const r of rates) {
    const currentRate = Number(r.ratePerSession) || 30000;
    const newRate = Math.max(1000, Math.round(currentRate * 0.1));
    await prisma.coachRate.update({
      where: { id: r.id },
      data: { ratePerSession: newRate },
    });
    console.log(`Updated CoachRate ID ${r.id}: ${currentRate} -> ${newRate}`);
  }

  console.log('--- HOÀN TẤT GIẢM GIÁ 10% CHO TOÀN BỘ COACH TRONG DATABASE ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
