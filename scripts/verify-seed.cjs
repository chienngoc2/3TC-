const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const codes = ['GYM', 'BOXING', 'YOGA', 'DANCING'];

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)),
  );
}

async function main() {
  const today = todayInVietnam();
  const monday = new Date(
    today.getTime() - ((today.getUTCDay() + 6) % 7) * 86400000,
  );
  const nextMonday = new Date(monday.getTime() + 7 * 86400000);
  const start = new Date(monday.getTime() - 7 * 3600000);
  const end = new Date(nextMonday.getTime() - 7 * 3600000);
  const now = new Date();
  const expected = {
    GYM: {
      TRIAL: [0, 0, 0],
      DROP_IN: [50000, 0, 0],
      PLUS: [300000, 0, 0],
      VIP: [300000, 0, 12],
    },
    BOXING: {
      TRIAL: [0, 1, 0],
      DROP_IN: [80000, 1, 0],
      PLUS: [700000, 10, 0],
      VIP: [500000, 4, 12],
    },
    YOGA: { TRIAL: [0, 3, 0], PLUS: [1000000, 12, 0], VIP: [600000, 4, 12] },
    DANCING: {
      TRIAL: [0, 1, 0],
      DROP_IN: [100000, 1, 0],
      PLUS: [650000, 8, 0],
      VIP: [1000000, 4, 12],
    },
  };
  const sharedRates = {
    GYM: 300000,
    BOXING: 420000,
    YOGA: 450000,
    DANCING: 380000,
  };
  const report = { week: monday.toISOString().slice(0, 10), disciplines: {} };
  for (const code of codes) {
    const discipline = await db.discipline.findUniqueOrThrow({
      where: { code },
    });
    const plans = await db.membershipPlan.findMany({
      where: { disciplineId: discipline.id, isActive: true },
    });
    const expectedCount = code === 'YOGA' ? 6 : 4;
    if (plans.length !== expectedCount)
      throw new Error(
        `${code} has ${plans.length} active plans, expected ${expectedCount}`,
      );
    for (const [tier, [price, groups, pt]] of Object.entries(expected[code])) {
      const match = plans.some(
        (plan) =>
          plan.packageTier === tier &&
          Number(plan.price) === price &&
          plan.groupSessionQuota === groups &&
          plan.ptSessionQuota === pt,
      );
      if (!match)
        throw new Error(
          `${code} ${tier} is missing or has the wrong price/quota`,
        );
    }
    if (code === 'YOGA') {
      for (const price of [120000, 150000, 180000]) {
        if (
          !plans.some(
            (plan) =>
              plan.packageTier === 'DROP_IN' && Number(plan.price) === price,
          )
        ) {
          throw new Error(`YOGA drop-in ${price} is missing`);
        }
      }
    }
    const rateRows = await db.coachRate.findMany({
      where: { disciplineId: discipline.id },
      include: {
        coach: {
          include: {
            coachProfile: {
              include: {
                coachSpecialties: { include: { specialty: true } },
              },
            },
          },
        },
      },
    });
    const coachIds = new Set(
      rateRows
        .filter((row) =>
          row.coach.coachProfile?.coachSpecialties.some(
            (item) => item.specialty.disciplineId === discipline.id,
          ),
        )
        .map((row) => row.coachId),
    );
    if (
      !rateRows.some(
        (row) =>
          row.coach.email === 'coach.minh@seed.sportscenter.test' &&
          Number(row.ratePerSession) === sharedRates[code],
      )
    ) {
      throw new Error(`${code} is missing the shared coach's discipline rate`);
    }
    if (coachIds.size !== 4)
      throw new Error(`${code} has ${coachIds.size} coaches, expected 4`);
    const members = await db.user.findMany({
      where: {
        email: {
          in: [
            `${code.toLowerCase()}-plus@seed.sportscenter.test`,
            `${code.toLowerCase()}-vip@seed.sportscenter.test`,
          ],
        },
      },
      include: {
        subscriptions: {
          where: {
            disciplineId: discipline.id,
            status: 'ACTIVE',
            endDate: { gte: today },
          },
        },
      },
    });
    if (
      members.length !== 2 ||
      members.some(
        (member) =>
          !member.subscriptions.some(
            (sub) =>
              sub.packageTier ===
              (member.email.includes('-vip@') ? 'VIP' : 'PLUS'),
          ),
      )
    ) {
      throw new Error(
        `${code} does not have exactly two demo members with active PLUS/VIP subscriptions`,
      );
    }
    const schedules = await db.schedule.findMany({
      where: {
        class: { disciplineId: discipline.id },
        startTime: { gte: start, lt: end },
        status: { in: ['OPEN', 'FULL'] },
      },
    });
    if (code === 'GYM' ? schedules.length !== 0 : schedules.length < 1) {
      throw new Error(
        `${code} has an invalid group class count: ${schedules.length}`,
      );
    }
    for (const coachId of coachIds) {
      const slots = await db.coachAvailability.count({
        where: {
          coachId,
          startTime: { gt: now, lt: end },
          isBooked: false,
          isEmergencyCancelled: false,
        },
      });
      if (slots < 5)
        throw new Error(
          `${code} coach ${coachId} has only ${slots} future free PT slots`,
        );
    }
    report.disciplines[code] = {
      activePlans: plans.length,
      coaches: coachIds.size,
      demoMembers: members.length,
      groupClasses: schedules.length,
      minFreePtSlots: 5,
    };
  }
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
