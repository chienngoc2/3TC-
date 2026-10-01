import {
  InvoiceStatus,
  InvoiceType,
  LockerStatus,
  PackageTier,
  PaymentMethod,
  PlanType,
  PrismaClient,
  SubscriptionStatus,
  TrainingMode,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();
const hour = 60 * 60 * 1000;
const day = 24 * hour;
type Code = 'GYM' | 'BOXING' | 'YOGA' | 'DANCING';
const codes: Code[] = ['GYM', 'BOXING', 'YOGA', 'DANCING'];

function seedId(...parts: string[]) {
  const hex = createHash('sha256')
    .update(`sportscenter-seed:${parts.join(':')}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function vietnamToday() {
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

function localTime(date: Date, h: number) {
  return new Date(date.getTime() + (h - 7) * hour);
}

function intersects(a: Date, b: Date, c: Date, d: Date) {
  return a < d && c < b;
}

async function main() {
  const today = vietnamToday();
  const monday = new Date(
    today.getTime() - ((today.getUTCDay() + 6) % 7) * day,
  );
  const nextMonday = new Date(monday.getTime() + 7 * day);
  const weekStart = localTime(monday, 0);
  const weekEnd = localTime(nextMonday, 0);
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const disciplines = {} as Record<Code, { id: string }>;
  const names: Record<Code, string> = {
    GYM: 'Gym & Fitness',
    BOXING: 'Boxing & Kickboxing',
    YOGA: 'Yoga & Meditation',
    DANCING: 'Zumba & Modern Dance',
  };
  for (const code of codes) {
    disciplines[code] = await db.discipline.upsert({
      where: { code },
      update: { name: names[code] },
      create: { code, name: names[code] },
    });
  }

  const admin = await db.user.upsert({
    where: { email: 'admin@sportscenter.com' },
    update: {},
    create: {
      email: 'admin@sportscenter.com',
      fullName: 'System Administrator',
      phone: '0901000000',
      role: UserRole.ADMIN,
      passwordHash,
    },
  });
  const manager = await db.user.upsert({
    where: { email: 'manager@sportscenter.com' },
    update: {},
    create: {
      email: 'manager@sportscenter.com',
      fullName: 'Center Manager',
      phone: '0901000001',
      role: UserRole.CENTER_MANAGER,
      createdById: admin.id,
      passwordHash,
    },
  });
  const receptionist = await db.user.upsert({
    where: { email: 'receptionist@sportscenter.com' },
    update: {},
    create: {
      email: 'receptionist@sportscenter.com',
      fullName: 'Receptionist',
      phone: '0901000004',
      role: UserRole.RECEPTIONIST,
      createdById: manager.id,
      passwordHash,
    },
  });

  const specialties = {} as Record<Code, { id: string }>;
  const specialtyCodes: Record<Code, string> = {
    GYM: 'SPEC_GYM_BB',
    BOXING: 'SPEC_BOX_KB',
    YOGA: 'SPEC_YOG_AS',
    DANCING: 'SPEC_DANCE_MODERN',
  };
  for (const code of codes) {
    specialties[code] = await db.specialty.upsert({
      where: { code: specialtyCodes[code] },
      update: { name: `${code} coaching`, disciplineId: disciplines[code].id },
      create: {
        code: specialtyCodes[code],
        name: `${code} coaching`,
        disciplineId: disciplines[code].id,
      },
    });
  }

  // The two original coaches are retained; one new coach teaches all four disciplines.
  // Each discipline therefore has exactly four assigned coaches in the seed cohort.
  const coachMatrix: {
    key: string;
    name: string;
    email: string;
    phone: string;
    rates: Partial<Record<Code, number>>;
  }[] = [
    {
      key: 'alex',
      name: 'Alex Ferguson',
      email: 'coach.alex@sportscenter.com',
      phone: '0901000002',
      rates: { GYM: 350000 },
    },
    {
      key: 'elena',
      name: 'Elena Rostova',
      email: 'coach.elena@sportscenter.com',
      phone: '0901000003',
      rates: { YOGA: 400000 },
    },
    {
      key: 'shared',
      name: 'Coach Minh Multi Sport',
      email: 'coach.minh@seed.sportscenter.test',
      phone: '0910000000',
      rates: { GYM: 300000, BOXING: 420000, YOGA: 450000, DANCING: 380000 },
    },
    {
      key: 'gym2',
      name: 'Coach Gym Two',
      email: 'coach.gym2@seed.sportscenter.test',
      phone: '0910000001',
      rates: { GYM: 250000 },
    },
    {
      key: 'gym3',
      name: 'Coach Gym Three',
      email: 'coach.gym3@seed.sportscenter.test',
      phone: '0910000002',
      rates: { GYM: 450000 },
    },
    {
      key: 'box1',
      name: 'Coach Boxing One',
      email: 'coach.box1@seed.sportscenter.test',
      phone: '0910000003',
      rates: { BOXING: 350000 },
    },
    {
      key: 'box2',
      name: 'Coach Boxing Two',
      email: 'coach.box2@seed.sportscenter.test',
      phone: '0910000004',
      rates: { BOXING: 400000 },
    },
    {
      key: 'box3',
      name: 'Coach Boxing Three',
      email: 'coach.box3@seed.sportscenter.test',
      phone: '0910000005',
      rates: { BOXING: 500000 },
    },
    {
      key: 'yog2',
      name: 'Coach Yoga Two',
      email: 'coach.yog2@seed.sportscenter.test',
      phone: '0910000006',
      rates: { YOGA: 350000 },
    },
    {
      key: 'yog3',
      name: 'Coach Yoga Three',
      email: 'coach.yog3@seed.sportscenter.test',
      phone: '0910000007',
      rates: { YOGA: 500000 },
    },
    {
      key: 'dan1',
      name: 'Coach Dance One',
      email: 'coach.dan1@seed.sportscenter.test',
      phone: '0910000008',
      rates: { DANCING: 300000 },
    },
    {
      key: 'dan2',
      name: 'Coach Dance Two',
      email: 'coach.dan2@seed.sportscenter.test',
      phone: '0910000009',
      rates: { DANCING: 350000 },
    },
    {
      key: 'dan3',
      name: 'Coach Dance Three',
      email: 'coach.dan3@seed.sportscenter.test',
      phone: '0910000010',
      rates: { DANCING: 450000 },
    },
  ];
  const coaches = {} as Record<string, { id: string }>;
  for (const item of coachMatrix) {
    const user = await db.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        email: item.email,
        fullName: item.name,
        phone: item.phone,
        role: UserRole.COACH,
        passwordHash,
        createdById: manager.id,
      },
    });
    if (user.role !== UserRole.COACH)
      throw new Error(`Seed email belongs to another role: ${item.email}`);
    coaches[item.key] = user;
    const profile = await db.coachProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialties: Object.keys(item.rates).join(', '),
        yearsExperience: 5,
      },
    });
    for (const code of Object.keys(item.rates) as Code[]) {
      await db.coachSpecialty.upsert({
        where: {
          coachProfileId_specialtyId: {
            coachProfileId: profile.id,
            specialtyId: specialties[code].id,
          },
        },
        update: {},
        create: {
          coachProfileId: profile.id,
          specialtyId: specialties[code].id,
        },
      });
      await db.coachRate.upsert({
        where: { id: seedId('rate', item.key, code) },
        update: {
          ratePerSession: item.rates[code]!,
          disciplineId: disciplines[code].id,
        },
        create: {
          id: seedId('rate', item.key, code),
          coachId: user.id,
          disciplineId: disciplines[code].id,
          ratePerSession: item.rates[code]!,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
  }

  const roomIds: Record<Code, string> = {
    GYM: '00000000-0000-0000-0000-000000000001',
    YOGA: '00000000-0000-0000-0000-000000000002',
    BOXING: seedId('room', 'BOXING'),
    DANCING: seedId('room', 'DANCING'),
  };
  for (const code of codes) {
    await db.room.upsert({
      where: { id: roomIds[code] },
      update: { capacity: code === 'DANCING' ? 20 : code === 'GYM' ? 50 : 10 },
      create: {
        id: roomIds[code],
        name: `${code} Studio`,
        capacity: code === 'DANCING' ? 20 : code === 'GYM' ? 50 : 10,
      },
    });
  }
  for (let i = 1; i <= 5; i++) {
    for (const prefix of ['M', 'F']) {
      const lockerNumber = `${prefix}-${String(i).padStart(2, '0')}`;
      await db.locker.upsert({
        where: { lockerNumber },
        update: {},
        create: {
          lockerNumber,
          zone: prefix === 'M' ? 'MALE_LOCKER' : 'FEMALE_LOCKER',
          status: LockerStatus.AVAILABLE,
        },
      });
    }
  }

  // VIP price is the base amount only; checkout adds 12 x the selected coach's discipline rate.
  const catalog: {
    code: Code;
    tier: PackageTier;
    label: string;
    price: number;
    days: number;
    groups: number;
    pt: number;
    gym: boolean;
    id?: string;
  }[] = [
    {
      code: 'GYM',
      tier: PackageTier.TRIAL,
      label: 'Trial',
      price: 0,
      days: 3,
      groups: 0,
      pt: 0,
      gym: true,
    },
    {
      code: 'GYM',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in',
      price: 50000,
      days: 1,
      groups: 0,
      pt: 0,
      gym: false,
    },
    {
      code: 'GYM',
      tier: PackageTier.PLUS,
      label: 'Plus',
      price: 300000,
      days: 30,
      groups: 0,
      pt: 0,
      gym: true,
      id: '00000000-0000-0000-0000-000000000010',
    },
    {
      code: 'GYM',
      tier: PackageTier.VIP,
      label: 'VIP',
      price: 300000,
      days: 30,
      groups: 0,
      pt: 12,
      gym: true,
    },
    {
      code: 'BOXING',
      tier: PackageTier.TRIAL,
      label: 'Trial',
      price: 0,
      days: 7,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'BOXING',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in',
      price: 80000,
      days: 1,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'BOXING',
      tier: PackageTier.PLUS,
      label: 'Plus',
      price: 700000,
      days: 30,
      groups: 10,
      pt: 0,
      gym: false,
    },
    {
      code: 'BOXING',
      tier: PackageTier.VIP,
      label: 'VIP',
      price: 500000,
      days: 30,
      groups: 4,
      pt: 12,
      gym: false,
    },
    {
      code: 'YOGA',
      tier: PackageTier.TRIAL,
      label: 'Trial',
      price: 0,
      days: 7,
      groups: 3,
      pt: 0,
      gym: false,
      id: '00000000-0000-0000-0000-000000000020',
    },
    {
      code: 'YOGA',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in Hatha',
      price: 120000,
      days: 1,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'YOGA',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in Vinyasa',
      price: 150000,
      days: 1,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'YOGA',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in Hot Yoga',
      price: 180000,
      days: 1,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'YOGA',
      tier: PackageTier.PLUS,
      label: 'Plus',
      price: 1000000,
      days: 30,
      groups: 12,
      pt: 0,
      gym: false,
      id: '00000000-0000-0000-0000-000000000030',
    },
    {
      code: 'YOGA',
      tier: PackageTier.VIP,
      label: 'VIP',
      price: 600000,
      days: 30,
      groups: 4,
      pt: 12,
      gym: false,
      id: '00000000-0000-0000-0000-000000000040',
    },
    {
      code: 'DANCING',
      tier: PackageTier.TRIAL,
      label: 'Trial',
      price: 0,
      days: 7,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'DANCING',
      tier: PackageTier.DROP_IN,
      label: 'Drop-in',
      price: 100000,
      days: 1,
      groups: 1,
      pt: 0,
      gym: false,
    },
    {
      code: 'DANCING',
      tier: PackageTier.PLUS,
      label: 'Plus',
      price: 650000,
      days: 30,
      groups: 8,
      pt: 0,
      gym: false,
    },
    {
      code: 'DANCING',
      tier: PackageTier.VIP,
      label: 'VIP',
      price: 1000000,
      days: 30,
      groups: 4,
      pt: 12,
      gym: false,
    },
  ];
  const plans = {} as Record<
    Code,
    Partial<Record<PackageTier, { id: string }>>
  >;
  for (const code of codes) plans[code] = {};
  for (const item of catalog) {
    const id = item.id ?? seedId('plan', item.code, item.label);
    const data = {
      disciplineId: disciplines[item.code].id,
      name: `${item.code} ${item.label}`,
      description:
        item.code === 'BOXING' && item.tier === PackageTier.VIP
          ? '4 group classes + 12 PT sessions + free boxing bag access'
          : `${item.groups} group classes + ${item.pt} PT sessions`,
      price: item.price,
      durationDays: item.days,
      sessionQuota: item.groups,
      planType: item.pt ? PlanType.PERSONAL_TRAINING : PlanType.GENERAL,
      packageTier: item.tier,
      trainingMode:
        item.code === 'GYM'
          ? TrainingMode.CUSTOM
          : item.pt
            ? TrainingMode.HYBRID
            : TrainingMode.GROUP_CLASS,
      groupSessionQuota: item.groups,
      ptSessionQuota: item.pt,
      unlimitedGymEntry: item.gym,
      isActive: true,
    };
    const plan = await db.membershipPlan.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    if (item.label === 'Plus' || item.label === 'VIP')
      plans[item.code][item.tier] = plan;
  }

  // Keep the historic sale but remove a zero-quota Boxing trial from the catalog.
  await db.membershipPlan.updateMany({
    where: {
      disciplineId: disciplines.BOXING.id,
      name: 'Free Trial',
      packageTier: PackageTier.TRIAL,
      groupSessionQuota: 0,
    },
    data: { isActive: false },
  });

  const vipCoaches: Record<Code, string> = {
    GYM: 'alex',
    BOXING: 'box1',
    YOGA: 'elena',
    DANCING: 'dan1',
  };
  for (const code of codes) {
    for (const tier of [PackageTier.PLUS, PackageTier.VIP]) {
      const key = `${code.toLowerCase()}-${tier.toLowerCase()}`;
      const email = `${key}@seed.sportscenter.test`;
      const member = await db.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          fullName: `Demo ${code} ${tier}`,
          role: UserRole.MEMBER,
          passwordHash,
          phone: `0920${String(codes.indexOf(code) * 2 + (tier === PackageTier.VIP ? 1 : 0)).padStart(6, '0')}`,
          createdById: receptionist.id,
        },
      });
      if (member.role !== UserRole.MEMBER)
        throw new Error(`Seed email belongs to another role: ${email}`);
      await db.memberProfile.upsert({
        where: { userId: member.id },
        update: {},
        create: { userId: member.id, fitnessGoals: `${code} ${tier} demo` },
      });
      const plan = plans[code][tier]!;
      const product = catalog.find((p) => p.code === code && p.tier === tier)!;
      const existing = await db.userSubscription.findFirst({
        where: {
          userId: member.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          endDate: { gte: today },
        },
      });
      if (existing) {
        const bookings = await db.booking.count({
          where: { subscriptionId: existing.id },
        });
        const originalEnd = new Date(
          existing.startDate.getTime() + product.days * day,
        );
        if (
          bookings === 0 &&
          existing.endDate.getTime() === originalEnd.getTime() &&
          existing.remainingSessions === product.groups
        ) {
          await db.userSubscription.update({
            where: { id: existing.id },
            data: {
              endDate: new Date(
                existing.startDate.getTime() + (product.days - 1) * day,
              ),
              remainingSessions: product.groups + product.pt,
            },
          });
        }
        continue; // Preserve consumed quotas and booking history on future runs.
      }
      const assignedCoachId =
        tier === PackageTier.VIP ? coaches[vipCoaches[code]].id : null;
      const subscription = await db.userSubscription.create({
        data: {
          id: seedId('subscription', key, monday.toISOString().slice(0, 10)),
          userId: member.id,
          planId: plan.id,
          disciplineId: disciplines[code].id,
          packageTier: tier,
          assignedCoachId,
          startDate: monday,
          endDate: new Date(monday.getTime() + (product.days - 1) * day),
          remainingSessions: product.groups + product.pt,
          remainingGroupSessions: product.groups,
          remainingPtSessions: product.pt,
          hasUnlimitedGymAccess: product.gym,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      const ptAmount =
        tier === PackageTier.VIP
          ? product.pt *
            coachMatrix.find((c) => c.key === vipCoaches[code])!.rates[code]!
          : 0;
      await db.invoice.create({
        data: {
          id: seedId('invoice', subscription.id),
          invoiceCode: `DEMO-${code}-${tier}-${monday.toISOString().slice(0, 10)}`,
          subscriptionId: subscription.id,
          issuerId: receptionist.id,
          baseAmount: product.price,
          ptAmount,
          amount: product.price + ptAmount,
          paymentMethod: PaymentMethod.MOCK,
          status: InvoiceStatus.PAID,
          type: InvoiceType.SUBSCRIPTION_NEW,
        },
      });
    }
  }

  const groupClasses: { code: Code; coach: string; capacity: number }[] = [
    { code: 'BOXING', coach: 'box1', capacity: 10 },
    { code: 'YOGA', coach: 'elena', capacity: 10 },
    { code: 'DANCING', coach: 'dan1', capacity: 20 },
  ];
  for (const entry of groupClasses) {
    const trainingClass = await db.class.upsert({
      where: { id: seedId('class', entry.code) },
      update: { name: `${entry.code} Weekly Group Class` },
      create: {
        id: seedId('class', entry.code),
        disciplineId: disciplines[entry.code].id,
        name: `${entry.code} Weekly Group Class`,
      },
    });
    const scheduleId = seedId(
      'schedule',
      entry.code,
      monday.toISOString().slice(0, 10),
    );
    if (await db.schedule.findUnique({ where: { id: scheduleId } })) continue;
    let created = false;
    for (let d = 0; d < 7 && !created; d++) {
      const date = new Date(monday.getTime() + d * day);
      for (const h of [18, 17, 16, 14, 10]) {
        const startTime = localTime(date, h),
          endTime = new Date(startTime.getTime() + hour);
        if (startTime <= new Date()) continue;
        const conflict = await db.schedule.findFirst({
          where: {
            status: { in: ['OPEN', 'FULL'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              { roomId: roomIds[entry.code] },
              { coachId: coaches[entry.coach].id },
            ],
          },
        });
        const slot = await db.coachAvailability.findFirst({
          where: {
            coachId: coaches[entry.coach].id,
            isEmergencyCancelled: false,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });
        if (conflict || slot) continue;
        await db.schedule.create({
          data: {
            id: scheduleId,
            classId: trainingClass.id,
            roomId: roomIds[entry.code],
            coachId: coaches[entry.coach].id,
            startTime,
            endTime,
            capacity: entry.capacity,
          },
        });
        created = true;
        break;
      }
    }
    if (!created)
      throw new Error(
        `No future group class time remains this week for ${entry.code}`,
      );
  }

  for (const coach of coachMatrix) {
    const coachId = coaches[coach.key].id;
    const slots = await db.coachAvailability.findMany({
      where: {
        coachId,
        startTime: { gte: weekStart, lt: weekEnd },
        isBooked: false,
        isEmergencyCancelled: false,
      },
    });
    let futureFree = slots.filter((slot) => slot.startTime > new Date()).length;
    if (futureFree >= 5) continue;
    const schedules = await db.schedule.findMany({
      where: {
        coachId,
        status: { in: ['OPEN', 'FULL'] },
        startTime: { lt: weekEnd },
        endTime: { gt: weekStart },
      },
    });
    for (const h of [8, 10, 14, 16, 18]) {
      for (let d = 0; d < 7 && futureFree < 5; d++) {
        const startTime = localTime(new Date(monday.getTime() + d * day), h);
        const endTime = new Date(startTime.getTime() + hour);
        if (startTime <= new Date()) continue;
        if (
          slots.some((s) =>
            intersects(startTime, endTime, s.startTime, s.endTime),
          ) ||
          schedules.some((s) =>
            intersects(startTime, endTime, s.startTime, s.endTime),
          )
        )
          continue;
        const slot = await db.coachAvailability.create({
          data: {
            id: seedId('slot', coach.key, startTime.toISOString()),
            coachId,
            startTime,
            endTime,
          },
        });
        slots.push(slot);
        futureFree++;
      }
    }
    if (futureFree < 5)
      throw new Error(
        `Fewer than five future PT slots this week for ${coach.email}`,
      );
  }
  console.log(
    JSON.stringify({
      week: monday.toISOString().slice(0, 10),
      plans: catalog.length,
      coachAssignments: 16,
      demoMembers: 8,
      groupClasses: groupClasses.length,
      futureSlotsPerCoach: 5,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
