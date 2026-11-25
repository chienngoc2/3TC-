import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coaches = await prisma.coachProfile.findMany();

  for (const cp of coaches) {
    if (Array.isArray(cp.workingHours)) {
      let modified = false;
      const sanitizedHours = (cp.workingHours as any[]).map((wh) => {
        let start = wh.start || wh.from || '08:00';
        let end = wh.end || wh.to || '12:00';

        // Strip minutes if not 00
        const [sH] = start.split(':');
        const [eH] = end.split(':');
        const cleanStart = `${sH.padStart(2, '0')}:00`;
        const cleanEnd = `${eH.padStart(2, '0')}:00`;

        if (cleanStart !== start || cleanEnd !== end) {
          modified = true;
        }
        return { start: cleanStart, end: cleanEnd };
      });

      if (modified) {
        await prisma.coachProfile.update({
          where: { id: cp.id },
          data: { workingHours: sanitizedHours },
        });
        console.log(`Updated coach profile ${cp.id} workingHours to even hours.`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
