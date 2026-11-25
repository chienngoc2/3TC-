import {
  PrismaClient,
  UserRole,
  UserGender,
  SubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();

async function main() {
  console.log('--- Connecting to Supabase DB ---');

  // Password for all test accounts
  const plainPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 1. Fetch admin if exists to set as createdById
  const existingAdmin = await db.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  // 2. Fetch disciplines for Coach rates
  const disciplines = await db.discipline.findMany();
  console.log(`Found ${disciplines.length} disciplines.`);

  // 3. Fetch active membership plans for Members
  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
  });
  console.log(`Found ${plans.length} active membership plans.`);

  const accountsToCreate = [
    {
      role: UserRole.ADMIN,
      email: 'admin.new@sportscenter.com',
      fullName: 'Nguyễn Quản Trị Viên',
      phone: '0981110001',
      gender: UserGender.MALE,
    },
    {
      role: UserRole.CENTER_MANAGER,
      email: 'manager.new@sportscenter.com',
      fullName: 'Trần Quản Lý Cơ Sở',
      phone: '0981110002',
      gender: UserGender.FEMALE,
    },
    {
      role: UserRole.COACH,
      email: 'coach.new@sportscenter.com',
      fullName: 'Lê Huấn Luyện Viên',
      phone: '0981110003',
      gender: UserGender.MALE,
      isCoach: true,
    },
    {
      role: UserRole.RECEPTIONIST,
      email: 'receptionist.new@sportscenter.com',
      fullName: 'Phạm Lễ Tân',
      phone: '0981110004',
      gender: UserGender.FEMALE,
    },
    {
      role: UserRole.MEMBER,
      email: 'member1.new@sportscenter.com',
      fullName: 'Hoàng Hội Viên Một',
      phone: '0981110005',
      gender: UserGender.MALE,
      isMember: true,
    },
    {
      role: UserRole.MEMBER,
      email: 'member2.new@sportscenter.com',
      fullName: 'Đỗ Hội Viên Hai',
      phone: '0981110006',
      gender: UserGender.FEMALE,
      isMember: true,
    },
  ];

  console.log('\n--- Creating / Updating Accounts ---');
  const results = [];

  for (const acc of accountsToCreate) {
    const user = await db.user.upsert({
      where: { email: acc.email },
      update: {
        fullName: acc.fullName,
        phone: acc.phone,
        role: acc.role,
        gender: acc.gender,
        passwordHash,
        isActive: true,
      },
      create: {
        email: acc.email,
        fullName: acc.fullName,
        phone: acc.phone,
        role: acc.role,
        gender: acc.gender,
        passwordHash,
        isActive: true,
        createdById: existingAdmin?.id,
      },
    });

    // If Coach, ensure CoachProfile and CoachRates exist
    if (acc.isCoach) {
      await db.coachProfile.upsert({
        where: { userId: user.id },
        update: {
          specialties: 'Gym & Fitness, Boxing, Cardio Strength',
          bio: 'HLV chuyên nghiệp với 5 năm kinh nghiệm huấn luyện thể hình và giảm cân.',
          yearsExperience: 5,
        },
        create: {
          userId: user.id,
          specialties: 'Gym & Fitness, Boxing, Cardio Strength',
          bio: 'HLV chuyên nghiệp với 5 năm kinh nghiệm huấn luyện thể hình và giảm cân.',
          yearsExperience: 5,
        },
      });

      // Add coach rates for each discipline
      for (const disc of disciplines) {
        const existingRate = await db.coachRate.findFirst({
          where: { coachId: user.id, disciplineId: disc.id },
        });
        if (!existingRate) {
          await db.coachRate.create({
            data: {
              coachId: user.id,
              disciplineId: disc.id,
              ratePerSession: 250000,
            },
          });
        }
      }
    }

    // If Member, ensure MemberProfile and an active Subscription exist
    if (acc.isMember) {
      await db.memberProfile.upsert({
        where: { userId: user.id },
        update: {
          heightCm: 172.5,
          weightKg: 68.0,
          bmi: 22.8,
          bodyFatPct: 18.5,
          fitnessGoals: 'Tăng cơ, giảm mỡ, cải thiện sức bền thể lực.',
        },
        create: {
          userId: user.id,
          heightCm: 172.5,
          weightKg: 68.0,
          bmi: 22.8,
          bodyFatPct: 18.5,
          fitnessGoals: 'Tăng cơ, giảm mỡ, cải thiện sức bền thể lực.',
        },
      });

      // Ensure user has at least 1 active subscription
      const existingSub = await db.userSubscription.findFirst({
        where: { userId: user.id },
      });

      if (!existingSub && plans.length > 0) {
        const plan = plans[0];
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 6); // 6 months subscription

        await db.userSubscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            disciplineId: plan.disciplineId,
            packageTier: plan.packageTier,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            remainingSessions: plan.sessionQuota ?? 30,
            remainingGroupSessions: plan.groupSessionQuota ?? 15,
            remainingPtSessions: plan.ptSessionQuota ?? 5,
            hasUnlimitedGymAccess: plan.unlimitedGymEntry ?? true,
          },
        });
      }
    }

    results.push({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      password: plainPassword,
    });
  }

  console.log('\n================ SUCCESSFULLY CREATED ACCOUNTS ================');
  console.table(results);

  // Check trigger auto-population on person names
  console.log('\n--- Checking Auto-populated Person Names via Triggers ---');
  const coachProfile = await db.coachProfile.findFirst({
    where: { user: { email: 'coach.new@sportscenter.com' } },
    select: { userId: true, user_name: true },
  });
  console.log('CoachProfile user_name:', coachProfile);

  const memberProfile = await db.memberProfile.findFirst({
    where: { user: { email: 'member1.new@sportscenter.com' } },
    select: { userId: true, user_name: true },
  });
  console.log('MemberProfile user_name:', memberProfile);

  const subscriptions = await db.userSubscription.findMany({
    where: { user: { email: { in: ['member1.new@sportscenter.com', 'member2.new@sportscenter.com'] } } },
    select: { id: true, userId: true, member_name: true },
  });
  console.log('UserSubscriptions member_name:', subscriptions);

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Error running script:', e);
  process.exit(1);
});
