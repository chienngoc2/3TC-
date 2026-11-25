const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const schedules = await prisma.schedule.findMany({
    take: 10,
    include: { class: true, room: true },
    orderBy: { startTime: 'desc' },
  });
  console.log('--- Sample Schedules ---');
  schedules.forEach(s => {
    console.log({
      id: s.id,
      className: s.class?.name,
      scheduleCapacity: s.capacity,
      roomName: s.room?.name,
      roomCapacity: s.room?.capacity,
      currentEnrolled: s.currentEnrolled,
    });
  });

  const rooms = await prisma.room.findMany();
  console.log('--- Rooms ---');
  rooms.forEach(r => console.log({ id: r.id, name: r.name, capacity: r.capacity }));
}

check().catch(console.error).finally(() => prisma.$disconnect());
