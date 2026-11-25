import {
  PrismaClient,
  PackageTier,
  TrainingMode,
  PlanType,
  ScheduleStatus,
} from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('--- Connecting to Supabase to update Plans, Classes, Curriculums, and Coach Availability ---');

  // 1. Fetch Disciplines
  const gym = await db.discipline.findFirst({ where: { code: 'GYM' } });
  const yoga = await db.discipline.findFirst({ where: { code: 'YOGA' } });
  const boxing = await db.discipline.findFirst({ where: { code: 'BOXING' } });

  if (!gym || !yoga || !boxing) {
    throw new Error('Disciplines GYM, YOGA, or BOXING missing in database.');
  }

  // 2. Yoga Topics & Roadmap Data
  const yogaTopics = [
    {
      topicNumber: 1,
      name: 'Hatha Yoga Nền Tảng',
      description: 'Nền tảng hơi thở Pranayama và định tuyến tư thế chuẩn, làm quen chuyển động và căn chỉnh khớp an toàn.',
      benefits: 'Cải thiện tư thế, tăng dung tích phổi, giảm căng thẳng',
      intensity: 'Căn bản',
    },
    {
      topicNumber: 2,
      name: 'Vinyasa Flow Năng Động',
      description: 'Chuỗi liên hoàn chuyển động đồng điệu nhịp thở, kích thích nhịp tim, đốt mỡ và tăng tuần hoàn máu.',
      benefits: 'Đốt cháy calo, cải thiện tim mạch, làm nóng toàn thân',
      intensity: 'Trung bình',
    },
    {
      topicNumber: 3,
      name: 'Yoga Giãn Cơ Chuyên Sâu (Deep Stretch)',
      description: 'Giải tỏa căng cứng các nhóm cơ lớn, mở khớp háng, giãn cơ đùi sau gân kheo và tăng biên độ vận động.',
      benefits: 'Tăng độ dẻo dai, giải phóng axit lactic, chống đau nhức',
      intensity: 'Nhẹ nhàng',
    },
    {
      topicNumber: 4,
      name: 'Yoga Trị Liệu Cột Sống & Cổ Vai Gáy',
      description: 'Chuyên đề phục hồi cột sống thắt lưng, nắn chỉnh gù lưng, mở khớp vai, xua tan đau mỏi cổ vai gáy dân văn phòng.',
      benefits: 'Hết đau mỏi cổ vai gáy, phòng ngừa thoái hóa cột sống',
      intensity: 'Trị liệu',
    },
    {
      topicNumber: 5,
      name: 'Power Yoga & Sức Bền Cơ Lõi (Core)',
      description: 'Tập trung siết cơ bụng, cơ liên sườn và thắt lưng, rèn luyện thăng bằng và sức chịu đựng của hệ cơ bắp.',
      benefits: 'Săn chắc vòng eo, tăng thăng bằng và sức mạnh toàn thân',
      intensity: 'Nâng cao',
    },
    {
      topicNumber: 6,
      name: 'Yin Yoga Phục Hồi & Thiền Định',
      description: 'Giữ tư thế tĩnh từ 3-5 phút tác động sâu vào mô liên kết và mạc cơ, kết hợp thiền chuông tĩnh tâm sâu.',
      benefits: 'Ngủ ngon, giảm stress sâu, cân bằng hệ thần kinh thực vật',
      intensity: 'Thư giãn sâu',
    },
  ];

  const yogaSchedulePreview = [
    {
      shift: 'Ca Sáng',
      time: '06:30 - 07:30',
      days: ['Thứ 2', 'Thứ 4', 'Thứ 6'],
      focus: 'Hatha Yoga & Vinyasa Flow khởi động ngày mới',
    },
    {
      shift: 'Ca Trưa',
      time: '11:45 - 12:45',
      days: ['Thứ 3', 'Thứ 5', 'Thứ 7'],
      focus: 'Yoga Trị Liệu Cổ Vai Gáy & Giãn cơ văn phòng',
    },
    {
      shift: 'Ca Chiều Tối',
      time: '18:00 - 19:00',
      days: ['Thứ 2', 'Thứ 4', 'Thứ 6'],
      focus: 'Power Yoga & Yin Yoga Thư Giãn phục hồi năng lượng',
    },
  ];

  const yogaRoadmap = {
    weeklySessions: 3,
    description: 'Lộ trình chuẩn 1 tuần khuyến nghị cho học viên Yoga:',
    schedule: [
      {
        day: 'Thứ 2',
        recommendedTopic: 'Hatha Yoga Căn Bản',
        target: 'Khởi động tuần mới, đánh thức cơ bắp và căn chỉnh tư thế',
      },
      {
        day: 'Thứ 4',
        recommendedTopic: 'Vinyasa Flow hoặc Power Yoga',
        target: 'Đốt calo, săn chắc cơ lõi và tăng cường thể lực tim mạch',
      },
      {
        day: 'Thứ 6',
        recommendedTopic: 'Yoga Giãn Cơ Chuyên Sâu hoặc Trị Liệu Cột Sống',
        target: 'Phục hồi khớp, xua tan căng thẳng sau tuần làm việc',
      },
    ],
  };

  const yogaTwoSportRule =
    'Nếu bạn đăng ký tập song song 2 bộ môn (ví dụ Yoga kết hợp Boxing/Gym): Hệ thống khuyến nghị mỗi môn chỉ nên tập tối đa 2 buổi/tuần (tổng 4 buổi/tuần), xen kẽ ngày nghỉ ngơi để cơ bắp phục hồi và tránh quá tải thể lực.';

  // 3. Boxing Topics & Roadmap Data
  const boxingTopics = [
    {
      topicNumber: 1,
      name: 'Bộ Pháp & Tư Thế Căn Bản (Footwork & Stance)',
      description: 'Tư thế thủ boxing tiêu chuẩn, nguyên lý trọng tâm và các bước di chuyển tiến, lùi, xoay góc thoát đòn.',
      benefits: 'Vững chắc trọng tâm, di chuyển linh hoạt, không mất đà',
      intensity: 'Căn bản',
    },
    {
      topicNumber: 2,
      name: 'Kỹ Thuật Đòn Tay Thẳng (Jab & Cross)',
      description: 'Phát lực xoay hông và vai với cú đấm thẳng số 1 (Jab) và số 2 (Cross), căn cự ly và thu tay phòng thủ.',
      benefits: 'Cú đấm thẳng tốc độ, chuẩn xác, kiểm soát cự ly',
      intensity: 'Trung bình',
    },
    {
      topicNumber: 3,
      name: 'Kỹ Thuật Móc Ngang & Móc Ngược (Hook & Uppercut)',
      description: 'Khai phá sức mạnh đòn móc số 3-4 (Hook) và đòn xốc số 5-6 (Uppercut) ở cự ly trung bình và cận chiến.',
      benefits: 'Gia tăng uy lực đấm, săn chắc cơ vai và liên sườn',
      intensity: 'Mạnh mẽ',
    },
    {
      topicNumber: 4,
      name: 'Phản Xạ & Né Đòn (Defense, Slip & Roll)',
      description: 'Kỹ thuật lắc đầu tránh đòn (Slip), thụp luồn (Roll/Bob and Weave), đỡ gạt và phản xạ trả đòn lập tức.',
      benefits: 'Nhanh mắt, tăng phản xạ sinh tồn và tự vệ',
      intensity: 'Thực chiến',
    },
    {
      topicNumber: 5,
      name: 'Tổ Hợp Đòn Combo Liên Hoàn (Combinations)',
      description: 'Phối hợp chuỗi đòn 3-5 đòn liên tiếp trên đích đấm (Pad work) và bao cát, biến hóa tốc độ và lực đấm.',
      benefits: 'Phản xạ đánh đòn tự nhiên, linh hoạt biến hóa nhịp độ',
      intensity: 'Cường độ cao',
    },
    {
      topicNumber: 6,
      name: 'Boxing Cardio & Thể Lực Chức Năng (Conditioning)',
      description: 'Bài tập thể lực chức năng HIIT kết hợp nhảy dây, đấm bao cát tốc độ cao và bài tập tăng cơ lõi Core.',
      benefits: 'Đốt 600-800 calo/buổi, bứt phá sức bền hô hấp',
      intensity: 'Đốt mỡ cực đại',
    },
  ];

  const boxingSchedulePreview = [
    {
      shift: 'Ca Sáng',
      time: '07:00 - 08:00',
      days: ['Thứ 3', 'Thứ 5', 'Thứ 7'],
      focus: 'Bộ Pháp Căn Bản & Đòn Tay Thẳng (Jab & Cross)',
    },
    {
      shift: 'Ca Chiều',
      time: '17:30 - 18:30',
      days: ['Thứ 2', 'Thứ 4', 'Thứ 6'],
      focus: 'Combo Liên Hoàn & Pad Work với Huấn Luyện Viên',
    },
    {
      shift: 'Ca Tối',
      time: '19:15 - 20:15',
      days: ['Thứ 2', 'Thứ 4', 'Thứ 6'],
      focus: 'Boxing Cardio Đốt Mỡ & Thể Lực Chức Năng HIIT',
    },
  ];

  const boxingRoadmap = {
    weeklySessions: 3,
    description: 'Lộ trình chuẩn 1 tuần khuyến nghị cho học viên Boxing:',
    schedule: [
      {
        day: 'Thứ 2',
        recommendedTopic: 'Bộ Pháp & Đòn Tay Thẳng (Jab/Cross)',
        target: 'Rèn kỹ thuật chuẩn và phản xạ di chuyển chân',
      },
      {
        day: 'Thứ 4',
        recommendedTopic: 'Combo Liên Hoàn & Phản Xạ Né Đòn',
        target: 'Luyện nhịp tim, tốc độ tay và đấm mục tiêu trên đích pad',
      },
      {
        day: 'Thứ 6',
        recommendedTopic: 'Boxing Cardio Thể Lực & Đốt Mỡ',
        target: 'Xả năng lượng, bứt phá sức bền và rèn luyện cơ lõi',
      },
    ],
  };

  const boxingTwoSportRule =
    'Nếu bạn tập song song cả Boxing và Yoga/Gym: Khuyến nghị mỗi môn chỉ tập 2 buổi/tuần (tổng 4 buổi). Tránh tập Boxing ngay sau ngày tập tạ nặng để khớp cổ tay và vai được nghỉ ngơi phục hồi tối đa.';

  // 4. Update Plans in Database:
  // Yoga & Boxing: ONLY Group Class plans! Disable VIP/PT plans for Yoga & Boxing.
  console.log('--- Deactivating Yoga and Boxing VIP/PT plans ---');
  await db.membershipPlan.updateMany({
    where: {
      disciplineId: { in: [yoga.id, boxing.id] },
      OR: [
        { packageTier: PackageTier.VIP },
        { ptSessionQuota: { gt: 0 } },
      ],
    },
    data: { isActive: false },
  });

  // Ensure Yoga Group Class Plan is active & populated
  console.log('--- Updating / Upserting Yoga Group Plan ---');
  const existingYogaPlan = await db.membershipPlan.findFirst({
    where: { disciplineId: yoga.id, packageTier: PackageTier.PLUS },
  });

  if (existingYogaPlan) {
    await db.membershipPlan.update({
      where: { id: existingYogaPlan.id },
      data: {
        name: 'Khóa Học Yoga Chuyên Đề Toàn Diện (12 Buổi / Tháng)',
        description: 'Khóa học Yoga 12 buổi trong 1 tháng bao gồm toàn diện 6 chuyên đề từ Hatha, Vinyasa đến Giãn cơ sâu và Trị liệu cột sống. Học viên được tự do chọn khung giờ và Huấn luyện viên yêu thích cho từng chuyên đề.',
        price: 450000,
        durationDays: 30,
        sessionQuota: 12,
        groupSessionQuota: 12,
        ptSessionQuota: 0,
        trainingMode: TrainingMode.GROUP_CLASS,
        packageTier: PackageTier.PLUS,
        isActive: true,
        curriculumTopics: yogaTopics as any,
        weeklySchedulePreview: yogaSchedulePreview as any,
        recommendedRoadmap: yogaRoadmap as any,
        twoSportRule: yogaTwoSportRule,
      },
    });
  } else {
    await db.membershipPlan.create({
      data: {
        disciplineId: yoga.id,
        name: 'Khóa Học Yoga Chuyên Đề Toàn Diện (12 Buổi / Tháng)',
        description: 'Khóa học Yoga 12 buổi trong 1 tháng bao gồm toàn diện 6 chuyên đề từ Hatha, Vinyasa đến Giãn cơ sâu và Trị liệu cột sống. Học viên được tự do chọn khung giờ và Huấn luyện viên yêu thích cho từng chuyên đề.',
        price: 450000,
        durationDays: 30,
        sessionQuota: 12,
        groupSessionQuota: 12,
        ptSessionQuota: 0,
        trainingMode: TrainingMode.GROUP_CLASS,
        packageTier: PackageTier.PLUS,
        isActive: true,
        curriculumTopics: yogaTopics as any,
        weeklySchedulePreview: yogaSchedulePreview as any,
        recommendedRoadmap: yogaRoadmap as any,
        twoSportRule: yogaTwoSportRule,
      },
    });
  }

  // Ensure Boxing Group Class Plan is active & populated
  console.log('--- Updating / Upserting Boxing Group Plan ---');
  const existingBoxingPlan = await db.membershipPlan.findFirst({
    where: { disciplineId: boxing.id, packageTier: PackageTier.PLUS },
  });

  if (existingBoxingPlan) {
    await db.membershipPlan.update({
      where: { id: existingBoxingPlan.id },
      data: {
        name: 'Khóa Học Boxing & Kickboxing Thể Lực (12 Buổi / Tháng)',
        description: 'Khóa học Boxing 12 buổi trong 1 tháng từ bộ pháp căn bản, kỹ thuật đòn tay đến né tránh phản xạ và thể lực thực chiến. Tự do lựa chọn HLV và khung giờ luyện tập.',
        price: 480000,
        durationDays: 30,
        sessionQuota: 12,
        groupSessionQuota: 12,
        ptSessionQuota: 0,
        trainingMode: TrainingMode.GROUP_CLASS,
        packageTier: PackageTier.PLUS,
        isActive: true,
        curriculumTopics: boxingTopics as any,
        weeklySchedulePreview: boxingSchedulePreview as any,
        recommendedRoadmap: boxingRoadmap as any,
        twoSportRule: boxingTwoSportRule,
      },
    });
  } else {
    await db.membershipPlan.create({
      data: {
        disciplineId: boxing.id,
        name: 'Khóa Học Boxing & Kickboxing Thể Lực (12 Buổi / Tháng)',
        description: 'Khóa học Boxing 12 buổi trong 1 tháng từ bộ pháp căn bản, kỹ thuật đòn tay đến né tránh phản xạ và thể lực thực chiến. Tự do lựa chọn HLV và khung giờ luyện tập.',
        price: 480000,
        durationDays: 30,
        sessionQuota: 12,
        groupSessionQuota: 12,
        ptSessionQuota: 0,
        trainingMode: TrainingMode.GROUP_CLASS,
        packageTier: PackageTier.PLUS,
        isActive: true,
        curriculumTopics: boxingTopics as any,
        weeklySchedulePreview: boxingSchedulePreview as any,
        recommendedRoadmap: boxingRoadmap as any,
        twoSportRule: boxingTwoSportRule,
      },
    });
  }

  // Update Gym VIP PT Plan with its curriculum and roadmap
  console.log('--- Updating Gym VIP PT Plan with Curriculum & Roadmap ---');
  const gymVipPlan = await db.membershipPlan.findFirst({
    where: { disciplineId: gym.id, packageTier: PackageTier.VIP },
  });
  if (gymVipPlan) {
    await db.membershipPlan.update({
      where: { id: gymVipPlan.id },
      data: {
        curriculumTopics: [
          {
            topicNumber: 1,
            name: 'Đo InBody & Đánh Giá Tư Thế Vận Động',
            description: 'Phân tích tỉ lệ mỡ/cơ, đánh giá độ lệch trục xương, kiểm tra chức năng tim mạch và xây dựng giáo án chuyên biệt 1:1.',
            benefits: 'Nắm rõ chỉ số cơ thể, cá nhân hóa mục tiêu tăng cơ giảm mỡ',
            intensity: 'Khảo sát',
          },
          {
            topicNumber: 2,
            name: 'Kích Hoạt Nhóm Cơ & Sức Mạnh Nền Tảng',
            description: 'Tập trung các bài tập phức hợp đa khớp (Squat, Deadlift, Bench Press) với kỹ thuật chuẩn an toàn tuyệt đối.',
            benefits: 'Xây dựng sức mạnh khung xương và nhóm cơ lớn',
            intensity: 'Nền tảng',
          },
          {
            topicNumber: 3,
            name: 'Hypertrophy Tăng Cơ & Định Hình Vóc Dáng',
            description: 'Tập trung kích thích phì đại cơ bắp (Hypertrophy), siết eo, nâng mông đùi và săn chắc cơ ngực/vai.',
            benefits: 'Kiến tạo vóc dáng săn chắc, tăng tỉ lệ trao đổi chất',
            intensity: 'Cường độ cao',
          },
        ] as any,
        weeklySchedulePreview: [
          {
            shift: 'Lịch Đặt Riêng Linh Hoạt',
            time: '06:00 - 21:00 Hàng Ngày',
            days: ['Tất cả các ngày trong tuần'],
            focus: 'Học viên chủ động chọn HLV cá nhân và book khung giờ rảnh theo ngày',
          },
        ] as any,
        recommendedRoadmap: {
          weeklySessions: 3,
          description: 'Lộ trình khuyến nghị tập kèm 1:1 với HLV Gym:',
          schedule: [
            { day: 'Thứ 2', recommendedTopic: 'Thân trên (Ngực, Vai, Tay sau)', target: 'Tăng sức mạnh đẩy' },
            { day: 'Thứ 4', recommendedTopic: 'Thân dưới (Đùi, Mông, Bắp chân)', target: 'Phát triển sức mạnh thân dưới' },
            { day: 'Thứ 6', recommendedTopic: 'Lưng xô & Cơ lõi (Core/Abs)', target: 'Định hình vóc dáng chữ V và siết eo' },
          ],
        } as any,
        twoSportRule: 'Khi tập PT Gym kết hợp Lớp Nhóm Yoga/Boxing: Khuyến nghị tập Gym 2-3 buổi/tuần, xen kẽ 1-2 buổi Yoga để giãn cơ xua tan căng cứng mô liên kết.',
      },
    });
  }

  // 5. Create Real Classes in DB for Yoga and Boxing
  console.log('--- Upserting Real Classes for Yoga and Boxing ---');
  for (const topic of yogaTopics) {
    const existing = await db.class.findFirst({
      where: { disciplineId: yoga.id, name: topic.name },
    });
    if (!existing) {
      await db.class.create({
        data: {
          disciplineId: yoga.id,
          name: topic.name,
          description: topic.description,
        },
      });
    }
  }

  for (const topic of boxingTopics) {
    const existing = await db.class.findFirst({
      where: { disciplineId: boxing.id, name: topic.name },
    });
    if (!existing) {
      await db.class.create({
        data: {
          disciplineId: boxing.id,
          name: topic.name,
          description: topic.description,
        },
      });
    }
  }

  // 6. Seed Coach Availability for active coaches
  console.log('--- Generating Real Availability and Shifts for Coaches ---');
  const coaches = await db.user.findMany({
    where: { role: 'COACH', isActive: true },
  });

  const rooms = await db.room.findMany({ where: { isActive: true } });
  const yogaRoom = rooms.find((r) => r.name.toLowerCase().includes('yoga')) || rooms[0];
  const boxingRoom = rooms.find((r) => r.name.toLowerCase().includes('box')) || rooms[0];

  const now = new Date();

  for (const coach of coaches) {
    // Generate shifts and availability for the next 14 days
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = targetDate.getDay(); // 0 is Sun, 6 is Sat
      if (dayOfWeek === 0) continue; // Skip Sunday

      // Morning shift: 07:00 - 12:00
      const morningStart = new Date(targetDate);
      morningStart.setHours(7, 0, 0, 0);
      const morningEnd = new Date(targetDate);
      morningEnd.setHours(12, 0, 0, 0);

      // Afternoon shift: 14:00 - 19:00
      const afternoonStart = new Date(targetDate);
      afternoonStart.setHours(14, 0, 0, 0);
      const afternoonEnd = new Date(targetDate);
      afternoonEnd.setHours(19, 0, 0, 0);

      // Upsert StaffShift for morning
      let shiftM = await db.staffShift.findFirst({
        where: { staffId: coach.id, startTime: morningStart },
      });
      if (!shiftM) {
        shiftM = await db.staffShift.create({
          data: {
            staffId: coach.id,
            startTime: morningStart,
            endTime: morningEnd,
            shiftDate: morningStart,
            notes: 'Ca sáng trực HLV',
          },
        });
      }

      // Upsert StaffShift for afternoon
      let shiftA = await db.staffShift.findFirst({
        where: { staffId: coach.id, startTime: afternoonStart },
      });
      if (!shiftA) {
        shiftA = await db.staffShift.create({
          data: {
            staffId: coach.id,
            startTime: afternoonStart,
            endTime: afternoonEnd,
            shiftDate: afternoonStart,
            notes: 'Ca chiều trực HLV',
          },
        });
      }

      // Create 1-hour availability slots inside morning and afternoon shifts
      const slotHours = [8, 9, 10, 15, 16, 17];
      for (const h of slotHours) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(h, 0, 0, 0);
        const slotEnd = new Date(targetDate);
        slotEnd.setHours(h + 1, 0, 0, 0);

        const existingSlot = await db.coachAvailability.findFirst({
          where: { coachId: coach.id, startTime: slotStart },
        });
        if (!existingSlot) {
          await db.coachAvailability.create({
            data: {
              coachId: coach.id,
              startTime: slotStart,
              endTime: slotEnd,
              isBooked: false,
              isEmergencyCancelled: false,
            },
          });
        }
      }
    }
  }

  // 7. Seed Real Group Schedules for the upcoming 7 days
  console.log('--- Generating Upcoming Schedules for Yoga and Boxing Classes ---');
  const yogaClasses = await db.class.findMany({ where: { disciplineId: yoga.id } });
  const boxingClasses = await db.class.findMany({ where: { disciplineId: boxing.id } });
  const leadCoach = coaches[0];

  if (leadCoach && yogaRoom) {
    for (let d = 1; d <= 7; d++) {
      const classDate = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const yClass = yogaClasses[(d - 1) % yogaClasses.length];

      // Schedule at 07:00 AM
      const sStart = new Date(classDate);
      sStart.setHours(7, 0, 0, 0);
      const sEnd = new Date(classDate);
      sEnd.setHours(8, 0, 0, 0);

      const existingSched = await db.schedule.findFirst({
        where: { classId: yClass.id, startTime: sStart },
      });
      if (!existingSched) {
        await db.schedule.create({
          data: {
            classId: yClass.id,
            roomId: yogaRoom.id,
            coachId: leadCoach.id,
            coach_name: leadCoach.fullName,
            startTime: sStart,
            endTime: sEnd,
            capacity: 20,
            currentEnrolled: 0,
            status: ScheduleStatus.OPEN,
          },
        });
      }
    }
  }

  if (leadCoach && boxingRoom) {
    for (let d = 1; d <= 7; d++) {
      const classDate = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const bClass = boxingClasses[(d - 1) % boxingClasses.length];

      // Schedule at 17:30 PM
      const sStart = new Date(classDate);
      sStart.setHours(17, 30, 0, 0);
      const sEnd = new Date(classDate);
      sEnd.setHours(18, 30, 0, 0);

      const existingSched = await db.schedule.findFirst({
        where: { classId: bClass.id, startTime: sStart },
      });
      if (!existingSched) {
        await db.schedule.create({
          data: {
            classId: bClass.id,
            roomId: boxingRoom.id,
            coachId: leadCoach.id,
            coach_name: leadCoach.fullName,
            startTime: sStart,
            endTime: sEnd,
            capacity: 16,
            currentEnrolled: 0,
            status: ScheduleStatus.OPEN,
          },
        });
      }
    }
  }

  console.log('\n================ DATA UPGRADE COMPLETED SUCCESSFULLY ================');
  const activePlans = await db.membershipPlan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      price: true,
      trainingMode: true,
      groupSessionQuota: true,
      ptSessionQuota: true,
      curriculumTopics: true,
    },
  });
  console.log(`Active plans count: ${activePlans.length}`);
  for (const p of activePlans) {
    console.log(`- ${p.name}: Group=${p.groupSessionQuota}, PT=${p.ptSessionQuota}, Topics=${Array.isArray(p.curriculumTopics) ? p.curriculumTopics.length : 0}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Error running upgrade script:', e);
  process.exit(1);
});
