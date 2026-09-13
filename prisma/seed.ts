import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial system data...');

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Seed Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@sportscenter.com' },
    update: {},
    create: {
      email: 'manager@sportscenter.com',
      passwordHash,
      fullName: 'Head Manager',
      phone: '0901000001',
      role: UserRole.MANAGER,
    },
  });

  // 2. Seed Coaches
  const coach1 = await prisma.user.upsert({
    where: { email: 'coach.alex@sportscenter.com' },
    update: {},
    create: {
      email: 'coach.alex@sportscenter.com',
      passwordHash,
      fullName: 'Alex Ferguson (Coach)',
      phone: '0901000002',
      role: UserRole.COACH,
      coachProfile: {
        create: {
          specialties: 'Gym, Strength & Conditioning',
          yearsExperience: 7,
          bio: 'Senior fitness coach with 7 years of bodybuilding expertise.',
        },
      },
    },
  });

  const coach2 = await prisma.user.upsert({
    where: { email: 'coach.elena@sportscenter.com' },
    update: {},
    create: {
      email: 'coach.elena@sportscenter.com',
      passwordHash,
      fullName: 'Elena Rostova (Coach)',
      phone: '0901000003',
      role: UserRole.COACH,
      coachProfile: {
        create: {
          specialties: 'Yoga, Pilates, Mobility',
          yearsExperience: 5,
          bio: 'Certified International Yoga Alliance instructor.',
        },
      },
    },
  });

  // 3. Seed Receptionist
  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@sportscenter.com' },
    update: {},
    create: {
      email: 'receptionist@sportscenter.com',
      passwordHash,
      fullName: 'Mai Receptionist',
      phone: '0901000004',
      role: UserRole.RECEPTIONIST,
    },
  });

  // 4. Seed Member
  const member = await prisma.user.upsert({
    where: { email: 'member.john@example.com' },
    update: {},
    create: {
      email: 'member.john@example.com',
      passwordHash,
      fullName: 'John Doe (Member)',
      phone: '0901000005',
      role: UserRole.MEMBER,
      memberProfile: {
        create: {
          heightCm: 175.5,
          weightKg: 72.0,
          bmi: 23.37,
          fitnessGoals: 'Muscle gain & fat loss',
        },
      },
    },
  });

  // 5. Seed Disciplines
  const gymDiscipline = await prisma.discipline.upsert({
    where: { name: 'Gym & Fitness' },
    update: {},
    create: {
      name: 'Gym & Fitness',
      description: 'Luyện tập thể hình tự do và có hướng dẫn viên',
    },
  });

  const yogaDiscipline = await prisma.discipline.upsert({
    where: { name: 'Yoga & Meditation' },
    update: {},
    create: {
      name: 'Yoga & Meditation',
      description: 'Cải thiện độ dẻo dai, nhịp thở và thư giãn tinh thần',
    },
  });

  // 6. Seed Rooms
  const roomA = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Phòng Gym Master 101',
      capacity: 30,
      locationNote: 'Tầng 1 - Khu A',
    },
  });

  const roomB = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Studio Yoga Lotus',
      capacity: 15,
      locationNote: 'Tầng 2 - Khu Yên Tĩnh',
    },
  });

  // 7. Seed Membership Plans
  const standardPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Gói Hội Viên Tháng Tiêu Chuẩn',
      description: 'Tập luyện tự do không giới hạn số lượt trong 30 ngày',
      price: 500000,
      durationDays: 30,
    },
  });

  const ptPlan = await prisma.membershipPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Gói 12 Buổi Kèm Huấn Luyện Viên',
      description: '12 buổi kèm 1:1 với HLV chuyên nghiệp, thời hạn 60 ngày',
      price: 3600000,
      durationDays: 60,
      sessionQuota: 12,
    },
  });

  console.log('Seeding completed successfully!');
  console.log({
    manager: manager.email,
    coaches: [coach1.email, coach2.email],
    receptionist: receptionist.email,
    member: member.email,
    plans: [standardPlan.name, ptPlan.name],
    rooms: [roomA.name, roomB.name],
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
