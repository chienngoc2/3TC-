import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ĐANG QUY CHUẨN WORKING HOURS & DAYS CHO TOÀN BỘ COACH ---');

  const profiles = await prisma.coachProfile.findMany({
    include: { user: { select: { fullName: true } } },
  });

  for (const cp of profiles) {
    let hours: { start: string; end: string }[] = [];
    if (Array.isArray(cp.workingHours)) {
      hours = (cp.workingHours as any[]).map((wh) => ({
        start: wh.start || wh.from || '08:00',
        end: wh.end || wh.to || '12:00',
      }));
    }

    // Filter out invalid or duplicate ranges
    const seen = new Set<string>();
    const cleaned: { start: string; end: string }[] = [];
    let totalMins = 0;

    for (const h of hours) {
      const key = `${h.start}-${h.end}`;
      if (seen.has(key)) continue;

      const [sH] = h.start.split(':').map(Number);
      const [eH] = h.end.split(':').map(Number);
      const dur = (eH - sH) * 60;

      if (dur > 0 && totalMins + dur <= 8 * 60) {
        seen.add(key);
        cleaned.push({
          start: `${String(sH).padStart(2, '0')}:00`,
          end: `${String(eH).padStart(2, '0')}:00`,
        });
        totalMins += dur;
      }
    }

    // Default to standard 08:00-12:00 if empty
    if (cleaned.length === 0) {
      cleaned.push({ start: '08:00', end: '12:00' });
    }

    // Clean workingDays
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    let days: string[] = Array.isArray(cp.workingDays) ? (cp.workingDays as string[]) : [];
    days = days.filter((d) => validDays.includes(d));
    if (days.length === 0) {
      days = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
    }

    await prisma.coachProfile.update({
      where: { id: cp.id },
      data: {
        workingHours: cleaned,
        workingDays: days,
      },
    });

    console.log(
      `Coach: ${cp.user?.fullName} | Days (${days.length}): ${JSON.stringify(days)} | Hours: ${JSON.stringify(cleaned)} (Total: ${totalMins / 60}h)`
    );
  }

  console.log('--- HOÀN TẤT QUY CHUẨN KHUNG GIỜ TOÀN BỘ COACH ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
