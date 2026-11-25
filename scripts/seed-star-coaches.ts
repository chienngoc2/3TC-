import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const coachData = [
  // Gym 2 sao
  {
    email: 'coach.gym.2star1@sportscenter.com',
    fullName: 'Nguyễn Hoàng Nam ',
    phone: '0901234001',
    disciplineCode: 'GYM',
    specialtyCode: 'SPEC_GYM_BB',
    ratingStars: 2,
    ratePerSession: 200000,
    yearsExperience: 2,
    bio: 'HLV Gym cơ bản & nâng cao thể lực, chuyên hướng dẫn người mới bắt đầu.',
    bankName: 'Vietcombank',
    bankAccountNumber: '0011002233441',
    bankAccountName: 'NGUYEN HOANG NAM',
    workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    workingHours: [{ start: '08:00', end: '12:00' }],
  },
  {
    email: 'coach.gym.2star2@sportscenter.com',
    fullName: 'Lê Đức Huy ',
    phone: '0901234002',
    disciplineCode: 'GYM',
    specialtyCode: 'SPEC_GYM_BB',
    ratingStars: 2,
    ratePerSession: 200000,
    yearsExperience: 3,
    bio: 'HLV Gym sức bền & tăng cơ tự nhiên, tận tâm theo sát học viên.',
    bankName: 'MB Bank',
    bankAccountNumber: '0901234002999',
    bankAccountName: 'LE DUC HUY',
    workingDays: ['TUESDAY', 'THURSDAY', 'SATURDAY'],
    workingHours: [{ start: '13:30', end: '17:30' }],
  },

  // Gym 4 sao
  {
    email: 'coach.gym.4star1@sportscenter.com',
    fullName: 'Trần Đình Trọng ',
    phone: '0901234003',
    disciplineCode: 'GYM',
    specialtyCode: 'SPEC_GYM_BB',
    ratingStars: 4,
    ratePerSession: 400000,
    yearsExperience: 8,
    bio: 'Master HLV Thể hình chuyên nghiệp, chứng chỉ quốc tế NASM & ISSA, chuyên siết cơ & phục hồi cơ học.',
    bankName: 'Techcombank',
    bankAccountNumber: '1903456789001',
    bankAccountName: 'TRAN DINH TRONG',
    workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    workingHours: [{ start: '14:00', end: '18:00' }],
  },
  {
    email: 'coach.gym.4star2@sportscenter.com',
    fullName: 'Vũ Minh Tuấn ',
    phone: '0901234004',
    disciplineCode: 'GYM',
    specialtyCode: 'SPEC_GYM_BB',
    ratingStars: 4,
    ratePerSession: 400000,
    yearsExperience: 7,
    bio: 'Chuyên gia huấn luyện thể lực & sức mạnh cường độ cao, thiết kế giáo trình dinh dưỡng cá nhân hóa.',
    bankName: 'ACB',
    bankAccountNumber: '23456789011',
    bankAccountName: 'VU MINH TUAN',
    workingDays: ['TUESDAY', 'THURSDAY', 'SUNDAY'],
    workingHours: [{ start: '08:00', end: '12:00' }],
  },

  // Yoga 2 sao & 4 sao
  {
    email: 'coach.yoga.2star@sportscenter.com',
    fullName: 'Trần Lan Anh ',
    phone: '0901234005',
    disciplineCode: 'YOGA',
    specialtyCode: 'SPEC_YOG_AS',
    ratingStars: 2,
    ratePerSession: 200000,
    yearsExperience: 3,
    bio: 'HLV Hatha Yoga cơ bản & Yoga giãn cơ phục hồi năng lượng.',
    bankName: 'VietinBank',
    bankAccountNumber: '102003004005',
    bankAccountName: 'TRAN LAN ANH',
    workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    workingHours: [{ start: '07:00', end: '11:00' }],
  },
  {
    email: 'coach.yoga.4star@sportscenter.com',
    fullName: 'Vũ Thu Phương ',
    phone: '0901234006',
    disciplineCode: 'YOGA',
    specialtyCode: 'SPEC_YOG_AS',
    ratingStars: 4,
    ratePerSession: 400000,
    yearsExperience: 8,
    bio: 'Chuyên gia Yoga Trị liệu cột sống & Vinyasa Flow, bằng 500h Yoga Alliance quốc tế.',
    bankName: 'Vietcombank',
    bankAccountNumber: '0011002233446',
    bankAccountName: 'VU THU PHUONG',
    workingDays: ['TUESDAY', 'THURSDAY', 'SATURDAY'],
    workingHours: [{ start: '15:00', end: '19:00' }],
  },

  // Boxing 2 sao & 4 sao
  {
    email: 'coach.box.2star@sportscenter.com',
    fullName: 'Lê Tuấn Kiệt ',
    phone: '0901234007',
    disciplineCode: 'BOXING',
    specialtyCode: 'SPEC_BOX_KB',
    ratingStars: 2,
    ratePerSession: 200000,
    yearsExperience: 3,
    bio: 'HLV Boxing thể lực & phản xạ cơ bản, năng động và nhiệt tình.',
    bankName: 'MB Bank',
    bankAccountNumber: '0901234007888',
    bankAccountName: 'LE TUAN KIET',
    workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    workingHours: [{ start: '17:00', end: '21:00' }],
  },
  {
    email: 'coach.box.4star@sportscenter.com',
    fullName: 'Trịnh Quốc Bảo ',
    phone: '0901234008',
    disciplineCode: 'BOXING',
    specialtyCode: 'SPEC_BOX_KB',
    ratingStars: 4,
    ratePerSession: 400000,
    yearsExperience: 9,
    bio: 'Cựu vận động viên Kickboxing quốc gia, chuyên sâu kỹ chiến thuật đối kháng & thể lực đỉnh cao.',
    bankName: 'Techcombank',
    bankAccountNumber: '1903456789008',
    bankAccountName: 'TRINH QUOC BAO',
    workingDays: ['TUESDAY', 'THURSDAY', 'SATURDAY'],
    workingHours: [{ start: '17:00', end: '21:00' }],
  },
];

const existingCoachUpdates: Record<string, { stars: number; rate: number }> = {
  'coach.alex@sportscenter.com': { stars: 5, rate: 500000 },
  'coach.elena@sportscenter.com': { stars: 5, rate: 500000 },
  'coach.minh@seed.sportscenter.test': { stars: 4, rate: 400000 },
  'coach.box1@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.box2@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.box3@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.yog2@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.yog3@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.gym2@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.gym3@seed.sportscenter.test': { stars: 3, rate: 300000 },
  'coach.new@sportscenter.com': { stars: 1, rate: 100000 },
};

const dayMap: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

async function generateSlots(coachId: string, coachName: string, workingDays: string[], workingHours: Array<{ start: string; end: string }>) {
  if (!workingDays.length || !workingHours.length) return;
  const targetDays = new Set(workingDays.map((d) => dayMap[d.toUpperCase()]));
  const today = new Date();

  const shiftsToCreate: any[] = [];
  const slotsToCreate: any[] = [];

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (!targetDays.has(d.getDay())) continue;

    for (const wh of workingHours) {
      const [sh, sm] = wh.start.split(':').map(Number);
      const [eh, em] = wh.end.split(':').map(Number);
      const shiftStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm);
      const shiftEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);

      shiftsToCreate.push({
        staffId: coachId,
        shiftDate: d,
        startTime: shiftStart,
        endTime: shiftEnd,
        notes: 'Ca làm việc tiêu chuẩn',
      });

      let curr = new Date(shiftStart);
      while (curr.getTime() + 60 * 60 * 1000 <= shiftEnd.getTime()) {
        const slotEnd = new Date(curr.getTime() + 60 * 60 * 1000);
        slotsToCreate.push({
          coachId,
          coach_name: coachName,
          startTime: curr,
          endTime: slotEnd,
          isBooked: false,
          approvalStatus: 'APPROVED',
        });
        curr = slotEnd;
      }
    }
  }

  if (shiftsToCreate.length > 0) {
    await prisma.staffShift.createMany({ data: shiftsToCreate });
  }
  if (slotsToCreate.length > 0) {
    await prisma.coachAvailability.createMany({ data: slotsToCreate });
  }
}

async function main() {
  console.log('--- SEEDING COACHES WITH STAR RATINGS ---');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Update existing coaches star ratings & rates
  for (const [email, info] of Object.entries(existingCoachUpdates)) {
    const coach = await prisma.user.findFirst({ where: { email } });
    if (coach) {
      await prisma.coachProfile.updateMany({
        where: { userId: coach.id },
        data: { ratingStars: info.stars, ratePerSession: info.rate },
      });
      // Also update or insert into coach_rates
      const spec = await prisma.coachSpecialty.findFirst({
        where: { coachProfile: { userId: coach.id } },
        include: { specialty: true },
      });
      if (spec) {
        await prisma.coachRate.upsert({
          where: { id: coach.id }, // fallback or create
          create: {
            coachId: coach.id,
            disciplineId: spec.specialty.disciplineId,
            ratePerSession: info.rate,
            coach_name: coach.fullName,
          },
          update: {
            ratePerSession: info.rate,
          },
        }).catch(() => {
          // In case id is unique or exists
          return prisma.coachRate.create({
            data: {
              coachId: coach.id,
              disciplineId: spec.specialty.disciplineId,
              ratePerSession: info.rate,
              coach_name: coach.fullName,
            },
          }).catch(() => {});
        });
      }
      console.log(`Updated existing coach ${coach.fullName} -> ${info.stars} stars (${info.rate} VND)`);
    }
  }

  // 2. Create or update the requested 8 coaches (2 Gym 2-star, 2 Gym 4-star, 2 Yoga, 2 Boxing)
  for (const item of coachData) {
    let user = await prisma.user.findUnique({ where: { email: item.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: item.email,
          fullName: item.fullName,
          phone: item.phone,
          passwordHash,
          role: UserRole.COACH,
          isActive: true,
        },
      });
      console.log(`Created user: ${user.fullName} (${user.email})`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { fullName: item.fullName, phone: item.phone },
      });
      console.log(`Updated user: ${user.fullName}`);
    }

    // Upsert CoachProfile
    const profile = await prisma.coachProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        user_name: item.fullName,
        bio: item.bio,
        yearsExperience: item.yearsExperience,
        bankName: item.bankName,
        bankAccountNumber: item.bankAccountNumber,
        bankAccountName: item.bankAccountName,
        workingDays: item.workingDays,
        workingHours: item.workingHours,
        ratingStars: item.ratingStars,
        ratePerSession: item.ratePerSession,
      },
      update: {
        user_name: item.fullName,
        bio: item.bio,
        yearsExperience: item.yearsExperience,
        bankName: item.bankName,
        bankAccountNumber: item.bankAccountNumber,
        bankAccountName: item.bankAccountName,
        workingDays: item.workingDays,
        workingHours: item.workingHours,
        ratingStars: item.ratingStars,
        ratePerSession: item.ratePerSession,
      },
    });

    // Specialty & Rate
    const specialty = await prisma.specialty.findUnique({
      where: { code: item.specialtyCode },
    });
    if (specialty) {
      const existingCS = await prisma.coachSpecialty.findFirst({
        where: { coachProfileId: profile.id, specialtyId: specialty.id },
      });
      if (!existingCS) {
        await prisma.coachSpecialty.create({
          data: { coachProfileId: profile.id, specialtyId: specialty.id },
        });
      }

      await prisma.coachRate.create({
        data: {
          coachId: user.id,
          disciplineId: specialty.disciplineId,
          ratePerSession: item.ratePerSession,
          coach_name: user.fullName,
        },
      }).catch(() => {});
    }

    // Check if slots exist for this coach, if not generate them
    const slotCount = await prisma.coachAvailability.count({ where: { coachId: user.id } });
    if (slotCount === 0) {
      console.log(`Generating slots for ${user.fullName}...`);
      await generateSlots(user.id, user.fullName, item.workingDays, item.workingHours);
    }
  }

  console.log('✅ ALL COACHES AND STAR RATINGS INITIALIZED SUCCESSFULLY!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
