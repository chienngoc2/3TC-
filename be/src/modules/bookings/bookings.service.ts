import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireRole,
  memberAccess,
  localDate,
} from '../../common/utils/domain';
import { ptDayBlockReason } from '../../common/utils/pt-day-policy';
import { parsePagination } from '../../common/dto/pagination.dto';
import { getVietnamDateRange } from '../../common/utils/timezone';
import {
  isClassCompatibleWithPlan,
  getClassSpecialtyCode,
  isCoachQualifiedForSpecialty,
} from '../../common/utils/topic-matcher';
import {
  GroupBookingDto,
  PtBookingDto,
  CancelDto,
  BookingListQueryDto,
} from '../commerce/dto/commerce.dto';
import { EmailService } from '../auth/email.service';
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
    private readonly email: EmailService,
  ) {}
  private async member(
    tx: Prisma.TransactionClient,
    actor: Actor,
    memberId?: string,
  ) {
    const id = memberId ?? actor.userId;
    await memberAccess(tx, actor, id);
    await requireRole(tx, id, UserRole.MEMBER);
    return id;
  }
  private async noOverlap(
    tx: Prisma.TransactionClient,
    memberId: string,
    startTime: Date,
    endTime: Date,
  ) {
    const overlap = await tx.booking.findFirst({
      where: {
        memberId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        OR: [
          {
            schedule: {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          },
          {
            coachAvailability: {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          },
        ],
      },
    });
    requireCondition(!overlap, 'MEMBER_SCHEDULE_OVERLAP');
  }
  private async quota(
    tx: Prisma.TransactionClient,
    memberId: string,
    disciplineId: string,
    date: Date,
    pt: boolean,
    coachId?: string,
    coachStars?: number,
  ) {
    const today = localDate(),
      sessionDate = localDate(date);
    const sub = requireRecord(
      await tx.userSubscription.findFirst({
        where: {
          userId: memberId,
          disciplineId,
          status: 'ACTIVE',
          startDate: { lte: today },
          ...(pt
            ? {
                // Cho phép đặt lịch HLV khi vẫn còn token PT dù thời hạn vào gym đã hết
                remainingPtSessions: { gt: 0 },
                OR: [
                  { assignedCoachId: coachId },
                  ...(coachStars
                    ? [
                        { coachRatingStars: coachStars },
                        { coachRatingStars: null },
                      ]
                    : []),
                ],
              }
            : {
                endDate: { gte: sessionDate > today ? sessionDate : today },
                remainingGroupSessions: { gt: 0 },
                ...(coachStars
                  ? {
                      OR: [
                        { coachRatingStars: coachStars },
                        { coachRatingStars: null },
                      ],
                    }
                  : {}),
              }),
        },
        include: { plan: true },
        orderBy: [{ endDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      'NO_VALID_SUBSCRIPTION_OR_QUOTA',
    );
    const column = pt ? 'remainingPtSessions' : 'remainingGroupSessions';
    const updated = await tx.userSubscription.updateMany({
      where: { id: sub.id, status: 'ACTIVE', [column]: { gt: 0 } },
      data: { [column]: { decrement: 1 }, remainingSessions: { decrement: 1 } },
    });
    requireCondition(updated.count === 1, 'QUOTA_EXHAUSTED');
    return sub;
  }
  private async reserve(
    tx: Prisma.TransactionClient,
    equipmentId: string | undefined,
    bookingId: string,
    startTime: Date,
    endTime: Date,
    roomId?: string,
  ) {
    if (!equipmentId) return;
    const machine = requireRecord(
      await tx.equipment.findUnique({
        where: { id: equipmentId },
        include: { room: true },
      }),
    );
    requireCondition(
      machine.isActive &&
        machine.room.isActive &&
        (!roomId || machine.roomId === roomId),
      'INVALID_EQUIPMENT',
    );
    await tx.equipmentReservation.create({
      data: { equipmentId, bookingId, startTime, endTime },
    });
  }
  private async autoAssignWorkoutPlan(
    tx: Prisma.TransactionClient,
    bookingId: string,
    subscriptionId: string,
    memberId: string,
    coachId: string,
    disciplineId?: string | null,
  ) {
    if (!disciplineId) return;
    const discipline = await tx.discipline.findUnique({
      where: { id: disciplineId },
    });
    if (!discipline) return;

    const sub = await tx.userSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    const isYoga =
      discipline.code === 'YOGA' ||
      (sub?.plan?.name || '').toLowerCase().includes('yoga') ||
      (sub?.plan?.name || '').toLowerCase().includes('trị liệu');

    if (isYoga) {
      // Find or create Bridge Pose exercise
      let bridgeEx = await tx.exerciseKnowledge.findFirst({
        where: {
          OR: [
            { title: { contains: 'Cây cầu', mode: 'insensitive' } },
            { title: { contains: 'Bridge', mode: 'insensitive' } },
          ],
        },
      });
      if (!bridgeEx) {
        bridgeEx = await tx.exerciseKnowledge.create({
          data: {
            title: 'Cây cầu (Bridge Pose)',
            category: 'backbends_seated',
            instructions: 'Thực hiện tư thế cây cầu giữ hông nâng cao và siết cơ mông đùi.',
          },
        });
      }

      await (tx as any).workoutPlan.create({
        data: {
          memberId,
          coachId,
          bookingId,
          sessionOrder: 1,
          title: sub?.plan?.name || 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống (12 Buổi / Tháng)',
          notes:
            '[CHUYÊN ĐỀ]: Đánh giá cơ xương khớp & Giải tỏa căng cứng vùng cổ vai gáy\n' +
            '• Nội dung: Buổi 1–3: Đánh giá cơ xương khớp & Giải tỏa căng cứng vùng cổ vai gáy',
          exercises: {
            create: [
              {
                exerciseId: bridgeEx.id,
                sets: 5,
                reps: 30,
                restSeconds: 60,
                orderIndex: 0,
              },
            ],
          },
        },
      });
      return;
    }

    const sessionCount = await tx.booking.count({
      where: {
        subscriptionId,
        status: { in: ['CONFIRMED', 'ATTENDED'] },
      },
    });

    if (sessionCount >= 1 && sessionCount <= 12) {
      const template = await (tx as any).workoutTemplate.findFirst({
        where: {
          disciplineCode: { equals: discipline.code, mode: 'insensitive' },
          sessionOrder: sessionCount,
        },
        include: { exercises: { orderBy: { orderIndex: 'asc' } } },
      });

      if (template) {
        await (tx as any).workoutPlan.create({
          data: {
            memberId,
            coachId,
            bookingId,
            templateId: template.id,
            sessionOrder: template.sessionOrder,
            title: template.title,
            notes: template.description,
            exercises: {
              create: template.exercises.map((e: any, orderIndex: number) => ({
                exerciseId: e.exerciseId,
                sets: e.sets,
                reps: e.reps,
                weightKg: e.weightKg,
                restSeconds: e.restSeconds,
                orderIndex,
              })),
            },
          },
        });
      }
    }
  }

  private async cloneSlotNotesWorkoutPlan(
    tx: Prisma.TransactionClient,
    bookingId: string,
    memberId: string,
    coachId: string,
    rawNotes: string,
  ) {
    const normalized = rawNotes.replace(/\r\n/g, '\n').trim();
    if (!normalized) return;

    const titleMatch = normalized.match(/^\[GIÁO ÁN\]:\s*([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Giáo án buổi tập';
    const topicMatch = normalized.match(/\[CHUYÊN ĐỀ\]:\s*([^\n]+)/);
    const descMatch = normalized.match(/•\s*Nội dung:\s*([^\n]+)/);
    const notesMatch = normalized.match(/--- GHI CHÚ ---\n([\s\S]+)$/);
    const rawExtra = (notesMatch ? notesMatch[1] : normalized)
      .replace(/^\[GIÁO ÁN\]:[^\n]*\n?/gm, '')
      .replace(/--- DANH SÁCH BÀI TẬP[^-]*---[\s\S]*?(?=--- GHI CHÚ ---|$)/g, '')
      .replace(/\[CHUYÊN ĐỀ\]:[^\n]*\n?/g, '')
      .replace(/•\s*Nội dung:[^\n]*\n?/g, '')
      .trim();

    const noteParts: string[] = [];
    if (topicMatch) {
      noteParts.push(`[CHUYÊN ĐỀ]: ${topicMatch[1].trim()}`);
      if (descMatch) noteParts.push(`• Nội dung: ${descMatch[1].trim()}`);
    }
    if (rawExtra) {
      noteParts.push(rawExtra);
    }
    const cleanNotes = noteParts.join('\n').trim() || null;

    const exerciseMatches = Array.from(
      normalized.matchAll(
        /^\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/gm,
      ),
    );

    const resolvedExercises: Array<{
      exerciseId: string;
      sets: number;
      reps: number;
      restSeconds: number;
    }> = [];

    for (const m of exerciseMatches) {
      const exTitle = m[1].trim();
      let found = await tx.exerciseKnowledge.findFirst({
        where: { title: { equals: exTitle, mode: 'insensitive' } },
      });
      if (!found) {
        found = await tx.exerciseKnowledge.findFirst({
          where: { title: { contains: exTitle, mode: 'insensitive' } },
        });
      }
      if (!found) {
        found = await tx.exerciseKnowledge.create({
          data: {
            title: exTitle,
            category: 'CUSTOM',
            instructions: 'Thực hiện theo hướng dẫn của HLV.',
          },
        });
      }
      resolvedExercises.push({
        exerciseId: found.id,
        sets: Number(m[2]) || 3,
        reps: Number(m[3]) || 10,
        restSeconds: m[4] ? Number(m[4]) : 60,
      });
    }

    await (tx as any).workoutPlan.create({
      data: {
        memberId,
        coachId,
        bookingId,
        title,
        notes: cleanNotes,
        exercises: {
          create: resolvedExercises.map((e, orderIndex) => ({
            exerciseId: e.exerciseId,
            sets: e.sets,
            reps: e.reps,
            restSeconds: e.restSeconds,
            orderIndex,
          })),
        },
      },
    });
  }
  async group(dto: GroupBookingDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      const memberId = await this.member(tx, actor, dto.memberId);
      await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${dto.scheduleId}::uuid FOR UPDATE`;
      const schedule = requireRecord(
        await tx.schedule.findUnique({
          where: { id: dto.scheduleId },
          include: {
            class: { include: { discipline: true } },
            coach: {
              include: {
                coachProfile: {
                  include: {
                    coachSpecialties: { include: { specialty: true } },
                  },
                },
              },
            },
            room: true,
          },
        }),
      );
      requireCondition(
        schedule.status === 'OPEN' &&
          schedule.currentEnrolled < schedule.capacity,
        'CLASS_FULL_OR_CLOSED',
      );
      requireCondition(
        schedule.startTime > new Date() &&
          schedule.coach.isActive &&
          schedule.room.isActive,
        'SESSION_UNAVAILABLE',
      );
      await this.noOverlap(tx, memberId, schedule.startTime, schedule.endTime);

      // Quy định nghiệp vụ: Mỗi ngày, cùng 1 bộ môn chỉ được đặt tối đa 1 slot
      const localDay = localDate(schedule.startTime);
      const dayStart = new Date(localDay.getTime() - 7 * 3600000);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const sameDayDisciplineBooking = await tx.booking.findFirst({
        where: {
          memberId,
          disciplineId: schedule.class.disciplineId,
          status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] },
          OR: [
            { schedule: { startTime: { gte: dayStart, lt: dayEnd } } },
            { coachAvailability: { startTime: { gte: dayStart, lt: dayEnd } } },
          ],
        },
        select: { id: true },
      });
      if (sameDayDisciplineBooking) {
        throw new ConflictException(
          'Mỗi ngày bạn chỉ được đặt tối đa 1 ca tập cho cùng một bộ môn.',
        );
      }

      const coachStars = schedule.coach?.coachProfile?.ratingStars ?? 3;
      const sub = await this.quota(
        tx,
        memberId,
        schedule.class.disciplineId,
        schedule.startTime,
        false,
        undefined,
        coachStars,
      );
      const subStars = (sub as any).coachRatingStars ?? 3;
      if (coachStars !== subStars) {
        throw new BadRequestException(
          `Gói tập của bạn (hạng ${subStars} sao) chỉ áp dụng cho lớp của HLV ${subStars} sao. Lớp này do HLV ${coachStars} sao phụ trách. Vui lòng chọn lớp có HLV cùng hạng hoặc đổi/nâng cấp gói.`,
        );
      }

      // Check Course Specialty compatibility (khóa học nào đi với chuyên đề lớp học đó)
      const subPlanName = (sub as any).plan?.name || '';
      const compatibility = isClassCompatibleWithPlan(
        schedule.class.name,
        subPlanName,
        schedule.class.discipline?.code,
      );
      if (!compatibility.isCompatible) {
        throw new BadRequestException(
          `Gói tập "${subPlanName}" (${compatibility.planSpecialtyName}) không áp dụng cho lớp học "${schedule.class.name}" (${compatibility.classSpecialtyName}). Vui lòng chọn lớp học đúng chuyên đề của gói tập.`,
        );
      }

      // Check if coach is qualified to teach this class specialty
      const coachSpecs =
        schedule.coach?.coachProfile?.coachSpecialties?.map(
          (cs: any) => cs.specialty?.code,
        ) || [];
      const classSpec = getClassSpecialtyCode(
        schedule.class.name,
        schedule.class.discipline?.code,
      );
      if (
        classSpec &&
        !isCoachQualifiedForSpecialty(
          coachSpecs,
          classSpec,
          schedule.class.discipline?.code,
        )
      ) {
        throw new BadRequestException(
          `Huấn luyện viên ${schedule.coach.fullName} chưa được cấp phép giảng dạy chuyên đề "${schedule.class.name}".`,
        );
      }
      const booking = await tx.booking.create({
        data: {
          subscriptionId: sub.id,
          scheduleId: schedule.id,
          memberId,
          disciplineId: schedule.class.disciplineId,
          bookingType: 'GROUP_CLASS',
        },
      });
      await this.reserve(
        tx,
        dto.equipmentId,
        booking.id,
        schedule.startTime,
        schedule.endTime,
        schedule.roomId,
      );
      const updatedSchedule = await tx.schedule.update({
        where: { id: schedule.id },
        data: { currentEnrolled: { increment: 1 } },
      });
      await audit(tx, actor, 'BOOK_GROUP_CLASS', 'bookings', booking.id);
      return {
        booking,
        coachId: schedule.coachId,
        schedule: updatedSchedule,
        remainingGroupSessions: (sub.remainingGroupSessions ?? 0) - 1,
      };
    });
    this.changed(result.booking, result.coachId, result.schedule);
    return {
      ...result.booking,
      bookingId: result.booking.id,
      remainingGroupSessions: result.remainingGroupSessions,
    };
  }
  async pt(dto: PtBookingDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      const memberId = await this.member(tx, actor, dto.memberId);
      const initial = requireRecord(
        await tx.coachAvailability.findUnique({
          where: { id: dto.coachAvailabilityId },
        }),
      );
      await requireRole(tx, initial.coachId, UserRole.COACH);
      requireCondition(
        await tx.coachSpecialty.findFirst({
          where: {
            coachProfile: { userId: initial.coachId },
            specialty: { disciplineId: dto.disciplineId },
          },
        }),
        'COACH_DISCIPLINE_MISMATCH',
      );
      requireCondition(
        initial.startTime > new Date(),
        'SESSION_ALREADY_STARTED',
      );
      const discipline = await tx.discipline.findUnique({
        where: { id: dto.disciplineId },
        select: { id: true, code: true, name: true },
      });
      const isGroupDiscipline =
        discipline?.code === 'YOGA' || discipline?.code === 'BOXING';

      const coachProfile = await tx.coachProfile.findUnique({
        where: { userId: initial.coachId },
        include: {
          coachSpecialties: {
            include: { specialty: { include: { discipline: true } } },
          },
        },
      });
      const coachDiscCodes = new Set(
        (coachProfile?.coachSpecialties || [])
          .map((cs: any) => cs.specialty?.discipline?.code?.toUpperCase())
          .filter(Boolean),
      );
      if (
        coachDiscCodes.size > 0 &&
        discipline?.code?.toUpperCase() === 'GYM' &&
        !coachDiscCodes.has('GYM') &&
        (coachDiscCodes.has('YOGA') || coachDiscCodes.has('BOXING'))
      ) {
        throw new BadRequestException(
          'HLV chuyên môn Nhóm (Yoga / Boxing) không được dạy kèm Gym PT 1-1.',
        );
      }
      if (
        coachDiscCodes.size > 0 &&
        isGroupDiscipline &&
        coachDiscCodes.has('GYM') &&
        !coachDiscCodes.has(discipline?.code?.toUpperCase() || '')
      ) {
        throw new BadRequestException(
          'HLV Gym & Fitness không được dạy lớp Nhóm (Yoga / Boxing).',
        );
      }
      const coachStars = coachProfile?.ratingStars ?? 3;

      const today = localDate();
      const activePtSub = await tx.userSubscription.findFirst({
        where: {
          userId: memberId,
          disciplineId: dto.disciplineId,
          status: 'ACTIVE',
          startDate: { lte: today },
          remainingPtSessions: { gt: 0 },
          OR: [
            { assignedCoachId: initial.coachId },
            ...(coachStars ? [{ coachRatingStars: coachStars }, { coachRatingStars: null }] : []),
          ],
        },
        include: { plan: true },
      });

      const isPtBooking =
        Boolean(activePtSub) &&
        !(
          isGroupDiscipline &&
          (activePtSub?.plan?.packageCategory === 'GROUP' ||
            (activePtSub?.remainingGroupSessions ?? 0) > 0)
        );

      if (isPtBooking) {
        const localDay = localDate(initial.startTime);
        const dayStart = new Date(localDay.getTime() - 7 * 3600000);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const sameDay = await tx.booking.findMany({
          where: {
            memberId,
            disciplineId: dto.disciplineId,
            bookingType: 'PERSONAL_TRAINING',
            status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED', 'CANCELLED'] },
            coachAvailability: { startTime: { gte: dayStart, lt: dayEnd } },
          },
          select: {
            status: true,
            cancelledAt: true,
            isLateCancellation: true,
            isEmergencyCancellation: true,
          },
        });
        const dayBlock = ptDayBlockReason(sameDay);
        if (dayBlock) throw new ConflictException(dayBlock);
      } else {
        // Quy định nghiệp vụ: Mỗi ngày, cùng 1 bộ môn chỉ được đặt tối đa 1 slot
        const localDay = localDate(initial.startTime);
        const dayStart = new Date(localDay.getTime() - 7 * 3600000);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const sameDayActive = await tx.booking.findFirst({
          where: {
            memberId,
            disciplineId: dto.disciplineId,
            status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] },
            OR: [
              { schedule: { startTime: { gte: dayStart, lt: dayEnd } } },
              { coachAvailability: { startTime: { gte: dayStart, lt: dayEnd } } },
            ],
          },
          select: { id: true },
        });
        if (sameDayActive) {
          throw new ConflictException(
            'Mỗi ngày bạn chỉ được đặt tối đa 1 ca tập cho cùng một bộ môn.',
          );
        }
      }

      if (initial.isBooked) {
        throw new ConflictException(
          isPtBooking
            ? 'Ca 1-1 này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.'
            : 'Ca tập này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.',
        );
      }
      const claim = await tx.coachAvailability.updateMany({
        where: { id: initial.id, isBooked: false, isEmergencyCancelled: false },
        data: { isBooked: true },
      });
      if (claim.count !== 1) {
        throw new ConflictException(
          isPtBooking
            ? 'Ca 1-1 này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.'
            : 'Ca tập này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.',
        );
      }

      // 5-Star Zone Conflict Check applies ONLY to 1-1 PT sessions of the SAME discipline.
      // Group Yoga/Boxing sessions and cross-discipline PT 1-1 sessions never conflict with each other.
      if (isPtBooking && !isGroupDiscipline) {
        const conflictingZone = await tx.coachAvailability.findFirst({
          where: {
            id: { not: initial.id },
            coachId: { not: initial.coachId },
            isBooked: true,
            isEmergencyCancelled: false,
            startTime: { lt: initial.endTime },
            endTime: { gt: initial.startTime },
            coach: {
              coachProfile: {
                ratingStars: coachStars,
              },
            },
            bookings: {
              some: {
                status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] },
                bookingType: 'PERSONAL_TRAINING',
                disciplineId: dto.disciplineId,
              },
            },
          },
          include: { coach: { select: { fullName: true } } },
        });
        if (conflictingZone) {
          throw new ConflictException(
            `Khu vực ${coachStars} sao của bộ môn này trong khung giờ đã có HLV ${conflictingZone.coach?.fullName || ''} (${coachStars} sao) được học viên đặt trước. Mỗi phòng tập có 5 khu vực (1-5 sao).`,
          );
        }
      }

      await this.noOverlap(tx, memberId, initial.startTime, initial.endTime);

      const sub = await this.quota(
        tx,
        memberId,
        dto.disciplineId,
        initial.startTime,
        isPtBooking,
        initial.coachId,
        coachStars,
      );
      const booking = await tx.booking.create({
        data: {
          subscriptionId: sub.id,
          coachAvailabilityId: initial.id,
          memberId,
          disciplineId: dto.disciplineId,
          bookingType: isPtBooking ? 'PERSONAL_TRAINING' : 'GROUP_CLASS',
        },
      });
      await this.reserve(
        tx,
        dto.equipmentId,
        booking.id,
        initial.startTime,
        initial.endTime,
      );
      // If coach pre-attached a workout plan on this slot, clone it onto the booking automatically
      if (initial.notes && initial.notes.trim()) {
        await this.cloneSlotNotesWorkoutPlan(
          tx,
          booking.id,
          memberId,
          initial.coachId,
          initial.notes,
        );
      }
      await audit(tx, actor, 'BOOK_PT', 'bookings', booking.id);

      // If another empty overlapping slot of the SAME discipline and SAME star rating exists,
      // remove it automatically once the first slot is booked so no dead duplicate slot remains.
      const overlappingEmptySlots = await tx.coachAvailability.findMany({
        where: {
          id: { not: initial.id },
          coachId: { not: initial.coachId },
          isBooked: false,
          isEmergencyCancelled: false,
          startTime: { lt: initial.endTime },
          endTime: { gt: initial.startTime },
          coach: {
            coachProfile: {
              ratingStars: coachStars,
            },
            OR: [
              {
                coachProfile: {
                  coachSpecialties: {
                    some: { specialty: { disciplineId: dto.disciplineId } },
                  },
                },
              },
              {
                coachRates: {
                  some: { disciplineId: dto.disciplineId },
                },
              },
            ],
          },
        },
        select: {
          id: true,
          coachId: true,
          _count: { select: { bookings: true } },
        },
      });
      const toHardDeleteIds = overlappingEmptySlots
        .filter((s) => s._count.bookings === 0)
        .map((s) => s.id);
      const toSoftHideIds = overlappingEmptySlots
        .filter((s) => s._count.bookings > 0)
        .map((s) => s.id);

      if (toHardDeleteIds.length > 0) {
        await tx.coachAvailability.deleteMany({
          where: { id: { in: toHardDeleteIds } },
        });
      }
      if (toSoftHideIds.length > 0) {
        await tx.coachAvailability.updateMany({
          where: { id: { in: toSoftHideIds } },
          data: { isEmergencyCancelled: true },
        });
      }

      return {
        booking,
        coachId: initial.coachId,
        remainingPtSessions: isPtBooking ? (sub.remainingPtSessions ?? 0) - 1 : sub.remainingPtSessions,
        remainingGroupSessions: !isPtBooking ? (sub.remainingGroupSessions ?? 0) - 1 : sub.remainingGroupSessions,
        removedSlots: overlappingEmptySlots.map((s) => ({
          id: s.id,
          coachId: s.coachId,
        })),
      };
    });
    this.changed(result.booking, result.coachId);
    for (const removed of result.removedSlots) {
      this.events.publish({
        name: 'slot.deleted',
        roles: ['MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
        data: { id: removed.id, coachId: removed.coachId },
      });
    }
    return {
      ...result.booking,
      bookingId: result.booking.id,
      remainingPtSessions: result.remainingPtSessions,
      remainingGroupSessions: result.remainingGroupSessions,
    };
  }
  changed(
    booking: { id: string; memberId: string; scheduleId: string | null },
    coachId: string,
    schedule?: {
      id: string;
      currentEnrolled: number;
      capacity: number;
      status: string;
    } | null,
  ) {
    this.events.publish({
      name: 'booking.updated',
      data: { bookingId: booking.id, scheduleId: booking.scheduleId },
      userIds: [booking.memberId, coachId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST', 'COACH', 'MEMBER'],
    });
    if (schedule)
      this.events.publish({
        name: 'schedule.updated',
        data: {
          scheduleId: schedule.id,
          currentEnrolled: schedule.currentEnrolled,
          capacity: schedule.capacity,
          status: schedule.status,
        },
        userIds: [booking.memberId, coachId],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST', 'COACH', 'MEMBER'],
      });
  }
  async list(actor: Actor, query?: BookingListQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);

    const baseWhere =
      actor.role === 'MEMBER'
        ? { memberId: actor.userId }
        : actor.role === 'COACH'
          ? {
              OR: [
                { schedule: { coachId: actor.userId } },
                { coachAvailability: { coachId: actor.userId } },
              ],
            }
          : query?.memberId
            ? { memberId: query.memberId }
            : {};

    const where = {
      ...baseWhere,
      ...(query?.status ? { status: query.status } : {}),
      ...(startUtc || endUtc
        ? {
            bookedAt: {
              ...(startUtc ? { gte: startUtc } : {}),
              ...(endUtc ? { lte: endUtc } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: {
          schedule: { include: { class: true } },
          coachAvailability: true,
          attendance: true,
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              memberProfile: true,
            },
          },
          subscription: { include: { plan: true } },
        },
        orderBy: { bookedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }
  async cancel(id: string, dto: CancelDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      const booking = requireRecord(
        await tx.booking.findUnique({
          where: { id },
          include: {
            schedule: {
              include: {
                class: true,
                room: true,
                coach: { include: { coachProfile: true } },
              },
            },
            coachAvailability: {
              include: {
                coach: { include: { coachProfile: true } },
              },
            },
            member: true,
          },
        }),
      );
      await memberAccess(tx, actor, booking.memberId);
      const session = requireRecord(
        booking.schedule ?? booking.coachAvailability,
      );
      requireCondition(
        session.startTime > new Date(),
        'SESSION_ALREADY_STARTED',
      );
      const late = session.startTime.getTime() - Date.now() < 7200000;
      const claim = await tx.booking.updateMany({
        where: { id, status: 'CONFIRMED' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          isLateCancellation: late,
          cancellationReason: dto.reason,
          cancelledBy: actor.role,
        },
      });
      requireCondition(claim.count === 1, 'BOOKING_ALREADY_PROCESSED');
      await this.release(tx, booking, !late);
      const schedule = booking.scheduleId
        ? await tx.schedule.findUnique({ where: { id: booking.scheduleId } })
        : null;
      await audit(tx, actor, 'CANCEL_BOOKING', 'bookings', id, {
        refunded: !late,
      });

      const isPt = booking.bookingType === 'PERSONAL_TRAINING' || !!booking.coachAvailabilityId;
      const sessionTitle = isPt
        ? 'Ca tập cá nhân 1-1 (PT)'
        : (booking.schedule?.class?.name || 'Lớp tập nhóm');
      const coach = booking.schedule?.coach || booking.coachAvailability?.coach;
      const member = booking.member;

      const formatHn = (d: Date) =>
        new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        }).format(d);

      const startTimeStr = formatHn(new Date(session.startTime));
      const endTimeStr = formatHn(new Date(session.endTime));

      return {
        booking,
        coachId: session.coachId,
        refunded: !late,
        schedule,
        isPt,
        sessionTitle,
        startTimeStr,
        endTimeStr,
        coach,
        member,
        reason: dto.reason,
      };
    });

    // 1. Send Email to Member (Học viên)
    if (result.member?.email) {
      void this.email.sendBookingCancelledMemberEmail(
        result.member.email,
        result.member.fullName || 'Hội viên',
        {
          sessionTitle: result.sessionTitle,
          startTime: result.startTimeStr,
          endTime: result.endTimeStr,
          coachName: result.coach?.fullName,
          isLateCancellation: !result.refunded,
          refunded: result.refunded,
          cancellationReason: result.reason,
        },
      );
    }

    // 2. Emit SSE Event booking.cancelled (Thông báo thời gian thực cho đúng HLV liên quan, Học viên và Quản lý/Lễ tân)
    const coachMsg = result.isPt
      ? `Học viên ${result.member?.fullName || 'Hội viên'} vừa hủy ca tập PT 1-1 lúc ${result.startTimeStr}${!result.refunded ? ' (Hủy sát giờ < 2h — HLV vẫn được tính thù lao)' : ' — Slot đã mở lại'}.`
      : `Học viên ${result.member?.fullName || 'Hội viên'} vừa hủy lịch lớp ${result.sessionTitle} lúc ${result.startTimeStr}${!result.refunded ? ' (Hủy sát giờ < 2h)' : ''}.`;
    const memberMsg = result.refunded
      ? `Bạn đã hủy lịch ${result.sessionTitle} lúc ${result.startTimeStr}. 01 lượt tập (token) đã được hoàn trả lại.`
      : `Bạn đã hủy sát giờ ${result.sessionTitle} lúc ${result.startTimeStr}. Theo quy định (< 2 tiếng), lượt tập này không được hoàn trả.`;

    this.events.publish({
      name: 'booking.cancelled',
      userIds: [result.coachId, result.booking.memberId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        bookingId: id,
        coachId: result.coachId,
        memberId: result.booking.memberId,
        scheduleId: result.booking.scheduleId,
        coachAvailabilityId: result.booking.coachAvailabilityId,
        memberName: result.member?.fullName || 'Học viên',
        coachName: result.coach?.fullName || 'HLV',
        sessionTitle: result.sessionTitle,
        sessionTime: result.startTimeStr,
        isLateCancellation: !result.refunded,
        refunded: result.refunded,
        reason: result.reason,
        coachMessage: coachMsg,
        memberMessage: memberMsg,
        message: coachMsg,
      },
    });

    this.changed(result.booking, result.coachId, result.schedule);
    return {
      id,
      bookingId: id,
      status: 'CANCELLED',
      refunded: result.refunded,
    };
  }
  async release(
    tx: Prisma.TransactionClient,
    booking: {
      id: string;
      subscriptionId: string;
      scheduleId: string | null;
      coachAvailabilityId: string | null;
      bookingType: string;
    },
    refund: boolean,
  ) {
    if (refund)
      await tx.userSubscription.update({
        where: { id: booking.subscriptionId },
        data: {
          ...(booking.bookingType === 'GROUP_CLASS'
            ? { remainingGroupSessions: { increment: 1 } }
            : { remainingPtSessions: { increment: 1 } }),
          remainingSessions: { increment: 1 },
        },
      });
    if (booking.scheduleId)
      await tx.schedule.update({
        where: { id: booking.scheduleId },
        data: { currentEnrolled: { decrement: 1 } },
      });
    if (booking.coachAvailabilityId) {
      if (refund) {
        // Hủy trước giờ quy định (được hoàn lại token): Ca đó trở lại thành ca trống để member khác có thể đăng ký
        await tx.coachAvailability.update({
          where: { id: booking.coachAvailabilityId },
          data: { isBooked: false, isEmergencyCancelled: false },
        });
      } else {
        // Hủy sát giờ (không hoàn token): Ca học đó biến mất (không thành ca trống, không ai đăng ký được nữa)
        await tx.coachAvailability.update({
          where: { id: booking.coachAvailabilityId },
          data: { isBooked: false, isEmergencyCancelled: true },
        });
      }
    }

    // Xóa nội dung bài tập / giáo án đã gắn với ca/booking này để ca trống không còn nội dung của học viên cũ
    const workoutPlans = await tx.workoutPlan.findMany({
      where: { bookingId: booking.id },
      select: { id: true },
    });
    if (workoutPlans.length > 0) {
      const planIds = workoutPlans.map((p) => p.id);
      await tx.workoutExercise.deleteMany({
        where: { workoutPlanId: { in: planIds } },
      });
      await tx.workoutPlan.deleteMany({
        where: { id: { in: planIds } },
      });
    }

    await tx.equipmentReservation.deleteMany({
      where: { bookingId: booking.id },
    });
  }
}
