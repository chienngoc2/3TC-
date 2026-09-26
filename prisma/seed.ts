import {
  PrismaClient,
  UserRole,
  PlanType,
  PackageTier,
  TrainingMode,
  LockerStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING PRODUCTION V5 DATA (4 DISCIPLINES, SPECIALTIES, LOCKERS, 5 ROLES) ---');

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Seed Disciplines (4 Bộ môn chuẩn: GYM, BOXING, YOGA, DANCING)
  const gym = await prisma.discipline.upsert({
    where: { code: 'GYM' },
    update: {},
    create: {
      code: 'GYM',
      name: 'Gym & Fitness',
      description: 'Luyện tập thể hình tự do và kèm 1:1 cùng Huấn luyện viên (Không có lớp nhóm)',
    },
  });

  const boxing = await prisma.discipline.upsert({
    where: { code: 'BOXING' },
    update: {},
    create: {
      code: 'BOXING',
      name: 'Boxing & Kickboxing',
      description: 'Võ đối kháng rèn luyện thể lực, phản xạ, tự vệ và đốt mỡ cường độ cao',
    },
  });

  const yoga = await prisma.discipline.upsert({
    where: { code: 'YOGA' },
    update: {},
    create: {
      code: 'YOGA',
      name: 'Yoga & Meditation',
      description: 'Cải thiện độ dẻo dai, nhịp thở, cột sống và thư giãn tinh thần',
    },
  });

  const dancing = await prisma.discipline.upsert({
    where: { code: 'DANCING' },
    update: {},
    create: {
      code: 'DANCING',
      name: 'Zumba & Modern Dance',
      description: 'Nhảy hiện đại và khiêu vũ thể thao sôi động giải tỏa căng thẳng',
    },
  });

  // 2. Seed Specialties (Danh mục chuyên môn)
  const specBodybuilding = await prisma.specialty.upsert({
    where: { code: 'SPEC_GYM_BB' },
    update: {},
    create: {
      disciplineId: gym.id,
      code: 'SPEC_GYM_BB',
      name: 'Bodybuilding & Hypertrophy',
      description: 'Chuyên môn tăng cơ, siết mỡ thể hình chuyên sâu',
    },
  });

  const specPowerlifting = await prisma.specialty.upsert({
    where: { code: 'SPEC_GYM_PL' },
    update: {},
    create: {
      disciplineId: gym.id,
      code: 'SPEC_GYM_PL',
      name: 'Powerlifting & Strength',
      description: 'Sức mạnh Squat, Bench, Deadlift tối đa',
    },
  });

  const specKickboxing = await prisma.specialty.upsert({
    where: { code: 'SPEC_BOX_KB' },
    update: {},
    create: {
      disciplineId: boxing.id,
      code: 'SPEC_BOX_KB',
      name: 'Kickboxing & Self Defense',
      description: 'Kỹ thuật đấm đá và phản xạ tự vệ thực chiến',
    },
  });

  const specAshtangaYoga = await prisma.specialty.upsert({
    where: { code: 'SPEC_YOG_AS' },
    update: {},
    create: {
      disciplineId: yoga.id,
      code: 'SPEC_YOG_AS',
      name: 'Ashtanga & Vinyasa Flow',
      description: 'Dòng Yoga chuyển động linh hoạt và sức bền thể lực',
    },
  });

  // 3. Seed Users (5 Vai trò: ADMIN -> CENTER_MANAGER -> COACH & RECEPTIONIST -> MEMBER)
  // Admin (IT)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sportscenter.com' },
    update: {},
    create: {
      email: 'admin@sportscenter.com',
      passwordHash,
      fullName: 'System Administrator (IT)',
      phone: '0901000000',
      role: UserRole.ADMIN,
    },
  });

  // Center Manager (Do Admin tạo)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@sportscenter.com' },
    update: {},
    create: {
      email: 'manager@sportscenter.com',
      passwordHash,
      fullName: 'Tran Van Quan Ly (Director)',
      phone: '0901000001',
      role: UserRole.CENTER_MANAGER,
      createdById: admin.id,
    },
  });

  // Coach 1: Alex (Gym + Boxing)
  const coach1 = await prisma.user.upsert({
    where: { email: 'coach.alex@sportscenter.com' },
    update: {},
    create: {
      email: 'coach.alex@sportscenter.com',
      passwordHash,
      fullName: 'Alex Ferguson (Coach Gym)',
      phone: '0901000002',
      role: UserRole.COACH,
      createdById: manager.id,
      coachProfile: {
        create: {
          specialties: 'Gym Bodybuilding, Sức mạnh',
          yearsExperience: 7,
          bio: 'Chuyên gia thể hình với 7 năm kinh nghiệm thi đấu quốc gia.',
        },
      },
      coachRates: {
        create: {
          ratePerSession: 350000,
          effectiveFrom: new Date(),
        },
      },
    },
    include: { coachProfile: true },
  });

  if (coach1.coachProfile) {
    await prisma.coachSpecialty.upsert({
      where: {
        coachProfileId_specialtyId: {
          coachProfileId: coach1.coachProfile.id,
          specialtyId: specBodybuilding.id,
        },
      },
      update: {},
      create: {
        coachProfileId: coach1.coachProfile.id,
        specialtyId: specBodybuilding.id,
      },
    });
  }

  // Coach 2: Elena (Yoga)
  const coach2 = await prisma.user.upsert({
    where: { email: 'coach.elena@sportscenter.com' },
    update: {},
    create: {
      email: 'coach.elena@sportscenter.com',
      passwordHash,
      fullName: 'Elena Rostova (Coach Yoga)',
      phone: '0901000003',
      role: UserRole.COACH,
      createdById: manager.id,
      coachProfile: {
        create: {
          specialties: 'Ashtanga, Vinyasa, Phục hồi',
          yearsExperience: 5,
          bio: 'Chứng chỉ Yoga Alliance 500h quốc tế.',
        },
      },
      coachRates: {
        create: {
          ratePerSession: 400000,
          effectiveFrom: new Date(),
        },
      },
    },
    include: { coachProfile: true },
  });

  if (coach2.coachProfile) {
    await prisma.coachSpecialty.upsert({
      where: {
        coachProfileId_specialtyId: {
          coachProfileId: coach2.coachProfile.id,
          specialtyId: specAshtangaYoga.id,
        },
      },
      update: {},
      create: {
        coachProfileId: coach2.coachProfile.id,
        specialtyId: specAshtangaYoga.id,
      },
    });
  }

  // Receptionist (Lễ tân)
  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@sportscenter.com' },
    update: {},
    create: {
      email: 'receptionist@sportscenter.com',
      passwordHash,
      fullName: 'Le Thi Le Tan',
      phone: '0901000004',
      role: UserRole.RECEPTIONIST,
      createdById: manager.id,
    },
  });

  // Member 1 (John Doe)
  const member1 = await prisma.user.upsert({
    where: { email: 'member.john@example.com' },
    update: {},
    create: {
      email: 'member.john@example.com',
      passwordHash,
      fullName: 'Nguyen Van John',
      phone: '0901000005',
      role: UserRole.MEMBER,
      createdById: receptionist.id,
      memberProfile: {
        create: {
          heightCm: 175.5,
          weightKg: 74.0,
          bmi: 24.03,
          bodyFatPct: 18.5,
          fitnessGoals: 'Tăng cơ giảm mỡ, cải thiện sức bền',
        },
      },
    },
  });

  // InBody log mẫu cho Member 1
  await prisma.memberInbodyLog.create({
    data: {
      userId: member1.id,
      measuredById: receptionist.id,
      heightCm: 175.5,
      weightKg: 74.0,
      muscleMassKg: 34.2,
      bodyFatPct: 18.5,
      bmi: 24.03,
      visceralFatLevel: 6,
      notes: 'Chỉ số đo đầu vào ngày khai mạc thẻ',
    },
  });

  // 4. Seed Rooms & Equipment
  const roomGym = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Phòng Gym Thể Hình 101',
      capacity: 50,
      locationNote: 'Tầng 1 - Khu Thể Thao Tự Do',
      equipment: {
        create: [
          { name: 'Máy chạy bộ Technogym Pro 1', equipmentType: 'CARDIO' },
          { name: 'Khung gánh tạ Smith Machine Alpha', equipmentType: 'STRENGTH' },
          { name: 'Ghế đẩy ngực Olympic Flat Bench', equipmentType: 'FREE_WEIGHT' },
        ],
      },
    },
  });

  const roomYoga = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Studio Yoga Sen Vàng 201',
      capacity: 20,
      locationNote: 'Tầng 2 - Khu Yên Tĩnh & Thiền',
    },
  });

  // 5. Seed Lockers (Tủ đồ Nam/Nữ/VIP)
  for (let i = 1; i <= 5; i++) {
    const num = i.toString().padStart(2, '0');
    await prisma.locker.upsert({
      where: { lockerNumber: `M-${num}` },
      update: {},
      create: {
        lockerNumber: `M-${num}`,
        zone: 'MALE_LOCKER',
        status: LockerStatus.AVAILABLE,
      },
    });
    await prisma.locker.upsert({
      where: { lockerNumber: `F-${num}` },
      update: {},
      create: {
        lockerNumber: `F-${num}`,
        zone: 'FEMALE_LOCKER',
        status: LockerStatus.AVAILABLE,
      },
    });
  }

  // 6. Seed Membership Plans theo ma trận 4 môn V5
  // ⚠️ update block có giá trị thực để seed idempotent/self-correcting khi chạy lại.
  //    update:{} là anti-pattern — chạy lại seed không sửa được số liệu sai.

  // Gói 1: Gym Plus — 300.000đ / 30 ngày / Vào cổng tự do không giới hạn
  const gymPlusPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: { price: 300000, durationDays: 30, groupSessionQuota: 0, ptSessionQuota: 0, unlimitedGymEntry: true },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      disciplineId: gym.id,
      name: 'Gói Gym Plus 30 Ngày',
      description: 'Vào cửa tập luyện tự do không giới hạn số lượt trong 30 ngày',
      price: 300000,
      durationDays: 30,
      planType: PlanType.GENERAL,
      packageTier: PackageTier.PLUS,
      trainingMode: TrainingMode.CUSTOM,
      unlimitedGymEntry: true,
      groupSessionQuota: 0,
      ptSessionQuota: 0,
    },
  });

  // Gói 2: Yoga Trial — 0đ / 7 ngày / 3 buổi thử (chỉ 1 lần / môn, bảo vệ bởi DB partial unique index)
  const yogaTrialPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: { price: 0, durationDays: 7, groupSessionQuota: 3 },
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      disciplineId: yoga.id,
      name: 'Gói Yoga Trải Nghiệm (Free Trial)',
      description: 'Tập thử 3 buổi lớp nhóm Yoga miễn phí trong 7 ngày (Chỉ áp dụng 1 lần / môn)',
      price: 0,
      durationDays: 7,
      planType: PlanType.GENERAL,
      packageTier: PackageTier.TRIAL,
      trainingMode: TrainingMode.GROUP_CLASS,
      groupSessionQuota: 3,
      ptSessionQuota: 0,
    },
  });

  // Gói 3: Yoga Plus — 1.000.000đ / 30 ngày / 15 buổi lớp nhóm
  const yogaPlusPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: { name: 'Gói Yoga Lớp Nhóm 15 Buổi', price: 1000000, durationDays: 30, groupSessionQuota: 15 },
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      disciplineId: yoga.id,
      name: 'Gói Yoga Lớp Nhóm 15 Buổi',
      description: 'Tham gia 15 buổi học Yoga nhóm trong 30 ngày',
      price: 1000000,         // Ma trận V5: 1.000.000đ / tháng
      durationDays: 30,       // Ma trận V5: 30 ngày
      planType: PlanType.GENERAL,
      packageTier: PackageTier.PLUS,
      trainingMode: TrainingMode.GROUP_CLASS,
      groupSessionQuota: 15,
      ptSessionQuota: 0,
    },
  });

  // Gói 4: Yoga VIP — Base 1.000.000đ / 30 ngày / 12PT + 15 Nhóm
  // ⚠️ price = BASE PRICE. Tổng thực = base + 12 × coach_rate — tính tại runtime bởi sp_purchase_vip_subscription.
  const yogaVipPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000040' },
    update: { name: 'Gói VIP Yoga (12 PT + 15 Lớp Nhóm)', description: 'Gói cao cấp: 12 buổi PT 1:1 + 15 buổi lớp nhóm / 30 ngày. Tổng = 1tr + 12 × coach_rate.', price: 1000000, durationDays: 30, groupSessionQuota: 15, ptSessionQuota: 12, unlimitedGymEntry: true },
    create: {
      id: '00000000-0000-0000-0000-000000000040',
      disciplineId: yoga.id,
      name: 'Gói VIP Yoga (12 PT + 15 Lớp Nhóm)',
      description: 'Gói cao cấp: 12 buổi PT 1:1 + 15 buổi lớp nhóm / 30 ngày. Tổng = 1tr + 12 × coach_rate.',
      price: 1000000,         // BASE PRICE — tổng thực tính lúc checkout khi biết coach
      durationDays: 30,
      planType: PlanType.PERSONAL_TRAINING,
      packageTier: PackageTier.VIP,
      trainingMode: TrainingMode.HYBRID,
      groupSessionQuota: 15,
      ptSessionQuota: 12,
      unlimitedGymEntry: true,
    },
  });

  console.log('--- SEEDING PRODUCTION V5 COMPLETED SUCCESSFULLY! ---');
  console.log({
    disciplines: [gym.name, boxing.name, yoga.name, dancing.name],
    specialties: [specBodybuilding.name, specPowerlifting.name, specKickboxing.name, specAshtangaYoga.name],
    users: [admin.email, manager.email, coach1.email, coach2.email, receptionist.email, member1.email],
    plans: [gymPlusPlan.name, yogaTrialPlan.name, yogaPlusPlan.name, yogaVipPlan.name],
    lockersCount: 10,
  });
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
