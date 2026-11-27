import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireOwner,
  requireRole,
  timeRange,
  localDate,
} from '../../common/utils/domain';
import {
  getVietnamDateRange,
  getVietnamDayBounds,
} from '../../common/utils/timezone';
import {
  SlotDto,
  BulkCreateSlotsDto,
  ApplySlotWorkoutPlanDto,
  RateDto,
  UpdateRateDto,
  ReviewExceptionDto,
  RespondSubstitutionDto,
  ReassignSubstituteDto,
} from '../operations/dto/operations.dto';
import { DomainEvents } from '../../common/events/domain-events';
import {
  getClassSpecialtyCode,
  getSpecialtyDedicatedRoomName,
} from '../../common/utils/topic-matcher';
import { isWithinCoachProfileSchedule } from '../../common/utils/coach-availability';
@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
  ) { }
  list() {
    return this.prisma.user.findMany({
      where: { role: UserRole.COACH, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        coachProfile: {
          include: { coachSpecialties: { include: { specialty: true } } },
        },
        coachRates: true,
      },
    });
  }
  slots(coachId?: string, from?: string, to?: string) {
    const { startUtc, endUtc } = getVietnamDateRange(from, to);
    return this.prisma.coachAvailability.findMany({
      where: {
        coachId,
        isEmergencyCancelled: false,
        OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
        startTime: {
          gt: new Date(),
          ...(startUtc ? { gte: startUtc } : {}),
          ...(endUtc ? { lte: endUtc } : {}),
        },
        coach: { isActive: true },
      },
      orderBy: { startTime: 'asc' },
      take: startUtc || endUtc ? undefined : 200,
    });
  }

  async updateRating(coachId: string, ratingStars: number, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, coachId, UserRole.COACH);
      requireCondition(
        Number.isInteger(ratingStars) && ratingStars >= 1 && ratingStars <= 5,
        'INVALID_RATING_STARS',
      );
      const ratePerSession = new (await import('@prisma/client')).Prisma.Decimal(
        ratingStars * 1000,
      );
      const coachProfile = await tx.coachProfile.upsert({
        where: { userId: coachId },
        create: {
          userId: coachId,
          ratingStars,
          ratePerSession,
        },
        update: {
          ratingStars,
          ratePerSession,
        },
      });

      const today = localDate();
      const existingRate = await tx.coachRate.findFirst({
        where: { coachId, effectiveTo: null },
      });
      if (existingRate) {
        await tx.coachRate.update({
          where: { id: existingRate.id },
          data: { ratePerSession },
        });
      } else {
        await tx.coachRate.create({
          data: {
            coachId,
            ratePerSession,
            effectiveFrom: today,
          },
        });
      }

      await audit(
        tx,
        actor,
        'UPDATE_COACH_RATING',
        'coach_profiles',
        coachProfile.id,
        {
          ratingStars,
          ratePerSession,
        },
      );

      return {
        coachId,
        ratingStars,
        ratePerSession,
      };
    });
  }
  rates(coachId: string) {
    return this.prisma.coachRate.findMany({
      where: { coachId },
      include: { discipline: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
  updateRate(coachId: string, id: string, dto: UpdateRateDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const rate = requireRecord(
        await tx.coachRate.findUnique({ where: { id } }),
      );
      requireCondition(rate.coachId === coachId, 'COACH_RATE_MISMATCH');
      if (dto.disciplineId) {
        const expertise = await tx.coachSpecialty.findFirst({
          where: {
            coachProfile: { userId: coachId },
            specialty: { disciplineId: dto.disciplineId },
          },
        });
        requireCondition(expertise, 'COACH_DISCIPLINE_MISMATCH');
      }
      const effectiveFrom = dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : rate.effectiveFrom,
        effectiveTo = dto.effectiveTo
          ? new Date(dto.effectiveTo)
          : rate.effectiveTo;
      requireCondition(
        !effectiveTo || effectiveTo >= effectiveFrom,
        'INVALID_RATE_RANGE',
      );
      const value = await tx.coachRate.update({
        where: { id },
        data: { ...dto, effectiveFrom, effectiveTo },
      });
      await audit(tx, actor, 'UPDATE_COACH_RATE', 'coach_rates', id, dto);
      return value;
    });
  }
  deleteRate(coachId: string, id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const rate = requireRecord(
        await tx.coachRate.findUnique({ where: { id } }),
      );
      requireCondition(
        rate.coachId === coachId && rate.effectiveFrom > localDate(),
        'ONLY_FUTURE_RATE_CAN_BE_DELETED',
      );
      await tx.coachRate.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_COACH_RATE', 'coach_rates', id);
      return { id };
    });
  }
  async ownSlots(actor: Actor, from?: string, to?: string) {
    const { startUtc, endUtc } = getVietnamDateRange(from, to);
    const recentCancelledSince = new Date(Date.now() - 14 * 86400000);
    const slots = await this.prisma.coachAvailability.findMany({
      where: {
        coachId: actor.userId,
        OR: [
          { isEmergencyCancelled: false, endTime: { gt: new Date() } },
          { isEmergencyCancelled: true, endTime: { gte: recentCancelledSince } },
        ],
        ...(startUtc || endUtc
          ? {
            startTime: {
              ...(startUtc ? { gte: startUtc } : {}),
              ...(endUtc ? { lte: endUtc } : {}),
            },
          }
          : {}),
      },
      include: {
        coach: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            coachProfile: {
              select: {
                ratingStars: true,
                coachSpecialties: {
                  include: {
                    specialty: {
                      include: { discipline: true },
                    },
                  },
                },
              },
            },
          },
        },
        bookings: {
          where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
          include: {
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
            attendance: true,
          },
          orderBy: { bookedAt: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
      take: startUtc || endUtc ? undefined : 200,
    });

    return slots.map((slot) => {
      const coachSpec = (slot as any).coach?.coachProfile?.coachSpecialties?.[0]?.specialty;
      const disciplineName = coachSpec?.discipline?.name || null;
      const disciplineCode = coachSpec?.discipline?.code || null;
      const specialtyName = coachSpec?.name || null;
      const isYogaOrBoxing = Boolean(
        disciplineName?.toLowerCase().includes('yoga') ||
        disciplineName?.toLowerCase().includes('boxing') ||
        disciplineCode?.toLowerCase().includes('yoga') ||
        disciplineCode?.toLowerCase().includes('box') ||
        specialtyName?.toLowerCase().includes('yoga') ||
        specialtyName?.toLowerCase().includes('boxing')
      );
      const packageCategory = isYogaOrBoxing ? 'GROUP' : 'ONE_ON_ONE';

      return {
        ...slot,
        disciplineName,
        disciplineCode,
        specialtyName,
        packageCategory,
      };
    });
  }
  createRate(coachId: string, dto: RateDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, coachId, UserRole.COACH);
      const expertise = await tx.coachSpecialty.findFirst({
        where: {
          coachProfile: { userId: coachId },
          specialty: { disciplineId: dto.disciplineId },
        },
      });
      requireCondition(expertise, 'COACH_DISCIPLINE_MISMATCH');
      const effectiveFrom = new Date(dto.effectiveFrom),
        effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
      requireCondition(
        !effectiveTo || effectiveTo >= effectiveFrom,
        'INVALID_RATE_RANGE',
      );
      const value = await tx.coachRate.create({
        data: {
          coachId,
          disciplineId: dto.disciplineId,
          ratePerSession: dto.ratePerSession,
          effectiveFrom,
          effectiveTo,
        },
      });
      await audit(tx, actor, 'CREATE_COACH_RATE', 'coach_rates', value.id);
      return value;
    });
  }
  async createSlot(dto: SlotDto, actor: Actor) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    timeRange(startTime, endTime);
    requireCondition(startTime > new Date(), 'SLOT_MUST_BE_FUTURE');

    // 1. Fetch coach profile & overlapping records in parallel
    const [coachUser, overlapping, shift] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          fullName: true,
          coachProfile: {
            select: {
              workingDays: true,
              workingHours: true,
              ratingStars: true,
              coachSpecialties: {
                select: {
                  specialtyId: true,
                  specialty: { select: { disciplineId: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.coachAvailability.findFirst({
        where: {
          coachId: actor.userId,
          isEmergencyCancelled: false,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      }),
      this.prisma.staffShift.findFirst({
        where: {
          staffId: actor.userId,
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
        select: { id: true },
      }),
    ]);

    if (overlapping) {
      throw new ConflictException(
        'Trùng lặp: Khung giờ này đã có ca rảnh hoặc giao thoa với một ca rảnh khác của bạn.',
      );
    }

    const coachStars = coachUser?.coachProfile?.ratingStars ?? 3;
    const coachSpecialtyIds =
      coachUser?.coachProfile?.coachSpecialties.map((cs) => cs.specialtyId) || [];
    const coachDisciplineIds = [
      ...new Set(
        coachUser?.coachProfile?.coachSpecialties
          .map((cs) => cs.specialty?.disciplineId)
          .filter(Boolean) as string[],
      ),
    ];

    if (coachSpecialtyIds.length > 0 || coachDisciplineIds.length > 0) {
      const bookedConflict = await this.prisma.coachAvailability.findFirst({
        where: {
          coachId: { not: actor.userId },
          isBooked: true,
          isEmergencyCancelled: false,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          coach: {
            coachProfile: {
              ratingStars: coachStars,
              coachSpecialties: {
                some: {
                  OR: [
                    { specialtyId: { in: coachSpecialtyIds } },
                    { specialty: { disciplineId: { in: coachDisciplineIds } } },
                  ],
                },
              },
            },
          },
        },
        select: {
          coach: { select: { fullName: true } },
        },
      });

      if (bookedConflict) {
        throw new ConflictException(
          `Khu vực ${coachStars} sao của bộ môn này trong khung giờ này đã có HLV ${bookedConflict.coach?.fullName || ''} (${coachStars} sao) được học viên đặt trước. Mỗi phòng gồm 5 khu vực (1-5 sao), mỗi cấp sao chỉ tối đa 1 HLV tiếp quản trong cùng khung giờ.`,
        );
      }
    }

    const dayOfWeekNames = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const dayCode = dayOfWeekNames[startTime.getDay()];
    const workingDays = Array.isArray(coachUser?.coachProfile?.workingDays)
      ? (coachUser.coachProfile.workingDays as string[])
      : [];
    const workingHours = Array.isArray(coachUser?.coachProfile?.workingHours)
      ? (coachUser.coachProfile.workingHours as any[])
      : [];

    const isWorkingDay = workingDays.includes(dayCode);
    const sHour = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    const eHour = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

    const isWithinRegisteredHours = workingHours.some((wh: any) => {
      if (wh.day && wh.day !== dayCode) return false;
      const regStart = wh.start || wh.from || '08:00';
      const regEnd = wh.end || wh.to || '12:00';
      return regStart <= sHour && regEnd >= eHour;
    });

    const isNormal = (isWorkingDay && isWithinRegisteredHours) || Boolean(shift);
    const isException = !isNormal;

    if (isException) {
      const leadTimeMs = startTime.getTime() - Date.now();
      if (leadTimeMs < 2 * 60 * 60 * 1000) {
        throw new BadRequestException(
          'Ca dạy ngoài giờ (ngoại lệ) cần gửi yêu cầu trước giờ bắt đầu tối thiểu 2 tiếng để Quản lý kịp thời phê duyệt.',
        );
      }
    }

    const approvalStatus = isException ? 'PENDING' : 'APPROVED';
    const resolvedNotes = await this.resolveSlotNotesFromPlan(
      actor.userId,
      dto.workoutPlanId,
      dto.notes,
    );

    const value = await this.prisma.coachAvailability.create({
      data: {
        coachId: actor.userId,
        startTime,
        endTime,
        isException,
        approvalStatus,
        exceptionReason: isException
          ? dto.exceptionReason || 'Dạy ngoài khung giờ đã đăng ký'
          : null,
        notes: resolvedNotes,
        coach_name: coachUser?.fullName || 'HLV',
      },
    });

    void audit(
      this.prisma,
      actor,
      isException ? 'REQUEST_EXCEPTION_SLOT' : 'CREATE_PT_SLOT',
      'coach_availability',
      value.id,
    ).catch(() => {});

    this.events.publish({
      name: 'slot.created',
      roles: ['MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        coachId: actor.userId,
        slotId: value.id,
        startTime: value.startTime,
        endTime: value.endTime,
      },
    });

    return value;
  }

  async createSlotsBulk(dto: BulkCreateSlotsDto, actor: Actor) {
    requireCondition(dto.slots && dto.slots.length > 0, 'NO_SLOTS_TO_CREATE');

    const now = new Date();
    // 1. Filter valid future slots
    const candidateSlots = (dto.slots || [])
      .map((s) => ({
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        exceptionReason: s.exceptionReason,
        notes: s.notes,
        workoutPlanId: s.workoutPlanId,
      }))
      .filter(
        (s) =>
          !isNaN(s.startTime.getTime()) &&
          !isNaN(s.endTime.getTime()) &&
          s.startTime < s.endTime &&
          s.startTime > now,
      );

    if (candidateSlots.length === 0) {
      return { count: 0, slots: [] };
    }

    const planIds = Array.from(
      new Set(
        candidateSlots
          .map((s) => s.workoutPlanId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const planNotesById = new Map<string, string>();
    if (planIds.length > 0) {
      const plans = await this.prisma.workoutPlan.findMany({
        where: { id: { in: planIds }, coachId: actor.userId },
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      plans.forEach((p) => {
        planNotesById.set(p.id, this.formatWorkoutPlanToNotes(p));
      });
    }

    // 2. Find min and max time range across candidates
    let minStartTime = candidateSlots[0].startTime;
    let maxEndTime = candidateSlots[0].endTime;
    for (const s of candidateSlots) {
      if (s.startTime < minStartTime) minStartTime = s.startTime;
      if (s.endTime > maxEndTime) maxEndTime = s.endTime;
    }

    // 3. Batch query existing records in parallel via this.prisma (concurrent pooler queries)
    const [user, existingSlots, existingSchedules, shifts] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          fullName: true,
          coachProfile: {
            select: {
              workingDays: true,
              workingHours: true,
              ratingStars: true,
              coachSpecialties: {
                select: {
                  specialtyId: true,
                  specialty: { select: { disciplineId: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.coachAvailability.findMany({
        where: {
          coachId: actor.userId,
          isEmergencyCancelled: false,
          startTime: { lt: maxEndTime },
          endTime: { gt: minStartTime },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.schedule.findMany({
        where: {
          coachId: actor.userId,
          status: { in: ['OPEN', 'FULL'] },
          startTime: { lt: maxEndTime },
          endTime: { gt: minStartTime },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.staffShift.findMany({
        where: {
          staffId: actor.userId,
          startTime: { lte: maxEndTime },
          endTime: { gte: minStartTime },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const coachName = user?.fullName || 'HLV';
    const coachProfile = user?.coachProfile;
    const currentCoachStars = coachProfile?.ratingStars ?? 3;
    const currentSpecialtyIds = new Set(
      coachProfile?.coachSpecialties?.map((cs) => cs.specialtyId) || [],
    );
    const currentDisciplineIds = new Set(
      coachProfile?.coachSpecialties
        ?.map((cs) => cs.specialty?.disciplineId)
        .filter(Boolean) as string[],
    );

    // 4. In parallel query conflicting booked slots from other coaches if applicable
    let otherBookedSlots: { startTime: Date; endTime: Date }[] = [];
    if (currentSpecialtyIds.size > 0 || currentDisciplineIds.size > 0) {
      otherBookedSlots = await this.prisma.coachAvailability.findMany({
        where: {
          coachId: { not: actor.userId },
          isBooked: true,
          isEmergencyCancelled: false,
          startTime: { lt: maxEndTime },
          endTime: { gt: minStartTime },
          coach: {
            coachProfile: {
              ratingStars: currentCoachStars,
              coachSpecialties: {
                some: {
                  OR: [
                    { specialtyId: { in: Array.from(currentSpecialtyIds) } },
                    { specialty: { disciplineId: { in: Array.from(currentDisciplineIds) } } },
                  ],
                },
              },
            },
          },
        },
        select: { startTime: true, endTime: true },
      });
    }

    const registeredDays: string[] = Array.isArray(coachProfile?.workingDays)
      ? (coachProfile.workingDays as string[])
      : [];
    const registeredHours: any[] = Array.isArray(coachProfile?.workingHours)
      ? (coachProfile.workingHours as any[])
      : [];

    // 5. In-memory conflict filtering (instant)
    const occupiedRanges: { startTime: Date; endTime: Date }[] = [
      ...existingSlots,
      ...existingSchedules,
      ...otherBookedSlots,
    ];

    const toCreate: {
      coachId: string;
      startTime: Date;
      endTime: Date;
      isException: boolean;
      approvalStatus: string;
      exceptionReason: string | null;
      notes: string | null;
      coach_name: string;
    }[] = [];

    const DAY_NAMES = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];

    for (const slot of candidateSlots) {
      const isOverlap = occupiedRanges.some(
        (r) => slot.startTime < r.endTime && slot.endTime > r.startTime,
      );
      if (isOverlap) {
        continue;
      }

      // Determine Vietnam Day of Week and Time string
      const vnDate = new Date(slot.startTime.getTime() + 7 * 60 * 60 * 1000);
      const dayIndex = vnDate.getUTCDay();
      const dayName = DAY_NAMES[dayIndex];

      const sHour =
        String(vnDate.getUTCHours()).padStart(2, '0') +
        ':' +
        String(vnDate.getUTCMinutes()).padStart(2, '0');
      const vnEndDate = new Date(slot.endTime.getTime() + 7 * 60 * 60 * 1000);
      const eHour =
        String(vnEndDate.getUTCHours()).padStart(2, '0') +
        ':' +
        String(vnEndDate.getUTCMinutes()).padStart(2, '0');

      // Check if slot falls within coach's registered recurring working hours
      const isWorkingDay = registeredDays.includes(dayName);
      const isWithinRegisteredHours = registeredHours.some((wh) => {
        if (wh.day && wh.day !== dayName) return false;
        const regStart = wh.start || wh.from || '08:00';
        const regEnd = wh.end || wh.to || '12:00';
        return regStart <= sHour && regEnd >= eHour;
      });

      // Or covered by an assigned staff shift
      const isCoveredByShift = shifts.some(
        (shift) =>
          shift.startTime <= slot.startTime && shift.endTime >= slot.endTime,
      );

      const isNormal =
        (isWorkingDay && isWithinRegisteredHours) || isCoveredByShift;
      const isException = !isNormal;

      if (isException) {
        const leadTimeMs = slot.startTime.getTime() - now.getTime();
        if (leadTimeMs < 2 * 60 * 60 * 1000) {
          continue; // Bỏ qua các ca ngoại lệ không đáp ứng thời hạn tạo trước tối thiểu 2 tiếng
        }
      }

      const approvalStatus = isException ? 'PENDING' : 'APPROVED';

      const slotNotes =
        (slot.workoutPlanId ? planNotesById.get(slot.workoutPlanId) : undefined) ||
        slot.notes?.trim() ||
        null;

      toCreate.push({
        coachId: actor.userId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isException,
        approvalStatus,
        exceptionReason: isException
          ? slot.exceptionReason || 'Dạy ngoài khung giờ đã đăng ký'
          : null,
        notes: slotNotes,
        coach_name: coachName,
      });

      occupiedRanges.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.coachAvailability.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    void audit(
      this.prisma,
      actor,
      'CREATE_SLOTS_BULK',
      'coach_availability',
      actor.userId,
      { count: toCreate.length },
    ).catch(() => {});

    if (toCreate.length > 0) {
      this.events.publish({
        name: 'slot.created',
        roles: ['MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          coachId: actor.userId,
          count: toCreate.length,
        },
      });
    }

    return { count: toCreate.length, slots: toCreate };
  }
  private formatWorkoutPlanToNotes(plan: {
    title: string;
    notes?: string | null;
    exercises?: Array<{
      sets?: number | null;
      reps?: number | null;
      restSeconds?: number | null;
      title?: string;
      exercise?: { title?: string | null } | null;
    }>;
  }): string {
    const lines: string[] = [`[GIÁO ÁN]: ${plan.title}`, ''];
    const rawNotes = (plan.notes || '').replace(/\r\n/g, '\n').trim();
    const topicMatch = rawNotes.match(/\[CHUYÊN ĐỀ\]:\s*([^\n]+)/);
    const descMatch = rawNotes.match(/•\s*Nội dung:\s*([^\n]+)/);
    if (topicMatch) {
      lines.push(`[CHUYÊN ĐỀ]: ${topicMatch[1].trim()}`);
      if (descMatch) lines.push(`• Nội dung: ${descMatch[1].trim()}`);
      lines.push('');
    }
    const exList = plan.exercises || [];
    if (exList.length > 0) {
      lines.push(`--- DANH SÁCH BÀI TẬP (${exList.length} động tác) ---`);
      exList.forEach((ex, idx) => {
        const title = ex.exercise?.title || ex.title || `Bài tập #${idx + 1}`;
        const sets = ex.sets || 3;
        const reps = ex.reps || 10;
        const rest = ex.restSeconds || 60;
        lines.push(`${idx + 1}. ${title}: ${sets} hiệp x ${reps} lần (Nghỉ ${rest}s)`);
      });
      lines.push('');
    }
    const extraOnly = (
      rawNotes.includes('--- GHI CHÚ ---')
        ? rawNotes.split('--- GHI CHÚ ---').pop() || ''
        : rawNotes
    )
      .replace(/^\[GIÁO ÁN\]:[^\n]*\n?/gm, '')
      .replace(/\[CHUYÊN ĐỀ\]:[^\n]*\n?/g, '')
      .replace(/•\s*Nội dung:[^\n]*\n?/g, '')
      .trim();
    if (extraOnly) {
      lines.push('--- GHI CHÚ ---');
      lines.push(extraOnly);
    }
    return lines.join('\n').trim();
  }

  private async resolveSlotNotesFromPlan(
    coachId: string,
    workoutPlanId?: string,
    rawNotes?: string,
  ): Promise<string | null> {
    if (workoutPlanId) {
      const plan = await this.prisma.workoutPlan.findFirst({
        where: { id: workoutPlanId, coachId },
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      if (plan) {
        return this.formatWorkoutPlanToNotes(plan);
      }
    }
    return rawNotes?.trim() || null;
  }

  async applyWorkoutPlanToSlot(
    slotId: string,
    dto: ApplySlotWorkoutPlanDto,
    actor: Actor,
  ) {
    return this.transactions.run(async (tx) => {
      const slot = requireRecord(
        await tx.coachAvailability.findUnique({
          where: { id: slotId },
          include: {
            bookings: {
              where: { status: { in: ['CONFIRMED', 'ATTENDED'] } },
            },
          },
        }),
      );
      requireOwner(actor, slot.coachId);

      let sourcePlan: any = null;
      if (dto.workoutPlanId) {
        sourcePlan = requireRecord(
          await tx.workoutPlan.findFirst({
            where: { id: dto.workoutPlanId, coachId: actor.userId },
            include: {
              exercises: {
                include: { exercise: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          }),
        );
      }

      const nextNotes = sourcePlan
        ? this.formatWorkoutPlanToNotes(sourcePlan)
        : dto.exercises && dto.exercises.length > 0
          ? this.formatWorkoutPlanToNotes({
              title: dto.title || 'Giáo án buổi tập',
              notes: dto.notes,
              exercises: dto.exercises,
            })
          : dto.notes?.trim() || null;

      const updatedSlot = await tx.coachAvailability.update({
        where: { id: slotId },
        data: { notes: nextNotes },
      });

      // Sync onto any already-booked session plans
      if (slot.bookings.length > 0 && (sourcePlan || (dto.exercises && dto.exercises.length > 0))) {
        const planTitle = sourcePlan?.title || dto.title || 'Giáo án buổi tập';
        const planNotes = sourcePlan ? sourcePlan.notes || '' : dto.notes || '';
        const sourceExercises = sourcePlan ? sourcePlan.exercises : dto.exercises || [];

        for (const b of slot.bookings) {
          const existing = await tx.workoutPlan.findFirst({
            where: { bookingId: b.id },
          });
          const resolvedExs: Array<{
            exerciseId: string;
            sets: number;
            reps: number;
            restSeconds: number;
            weightKg: number | null;
          }> = [];

          for (const ex of sourceExercises) {
            let exId = ex.exerciseId;
            if (!exId && ex.title) {
              const found = await tx.exerciseKnowledge.findFirst({
                where: { title: { equals: String(ex.title).trim(), mode: 'insensitive' } },
              });
              if (found) exId = found.id;
            }
            if (exId) {
              resolvedExs.push({
                exerciseId: exId,
                sets: Number(ex.sets) || 3,
                reps: Number(ex.reps) || 10,
                restSeconds: Number(ex.restSeconds) || 60,
                weightKg:
                  ex.weightKg !== undefined && ex.weightKg !== null
                    ? Number(ex.weightKg)
                    : null,
              });
            }
          }

          if (existing) {
            await tx.workoutExercise.deleteMany({
              where: { workoutPlanId: existing.id },
            });
            await tx.workoutPlan.update({
              where: { id: existing.id },
              data: {
                title: planTitle,
                notes: planNotes,
                exercises: {
                  create: resolvedExs.map((e, orderIndex) => ({
                    ...e,
                    orderIndex,
                  })),
                },
              },
            });
          } else {
            await tx.workoutPlan.create({
              data: {
                memberId: b.memberId,
                coachId: actor.userId,
                bookingId: b.id,
                title: planTitle,
                notes: planNotes,
                exercises: {
                  create: resolvedExs.map((e, orderIndex) => ({
                    ...e,
                    orderIndex,
                  })),
                },
              },
            });
          }
        }
      }

      await audit(tx, actor, 'APPLY_SLOT_WORKOUT_PLAN', 'coach_availability', slotId);
      return updatedSlot;
    });
  }

  deleteSlot(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const slot = requireRecord(
        await tx.coachAvailability.findUnique({ where: { id } }),
      );
      requireOwner(actor, slot.coachId);
      requireCondition(!slot.isBooked, 'SLOT_ALREADY_BOOKED');
      // Historical slots are retained so bookings/attendance cannot cascade away.
      if (await tx.booking.count({ where: { coachAvailabilityId: id } }))
        await tx.coachAvailability.update({
          where: { id },
          data: { isEmergencyCancelled: true },
        });
      else await tx.coachAvailability.delete({ where: { id } });
      await audit(tx, actor, 'REMOVE_PT_SLOT', 'coach_availability', id);
      this.events.publish({
        name: 'slot.deleted',
        roles: ['MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
        data: { id, coachId: slot.coachId },
      });
      return { id };
    });
  }
  schedule(actor: Actor, dateInput?: string) {
    const { startUtc, endUtc } = getVietnamDayBounds(dateInput || new Date());
    return Promise.all([
      this.prisma.schedule.findMany({
        where: {
          coachId: actor.userId,
          startTime: { gte: startUtc, lte: endUtc },
        },
        include: {
          class: true,
          room: true,
          bookings: {
            where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
            include: {
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
              attendance: true,
            },
            orderBy: { bookedAt: 'asc' },
          },
        },
      }),
      this.prisma.coachAvailability.findMany({
        where: {
          coachId: actor.userId,
          startTime: { gte: startUtc, lte: endUtc },
          OR: [{ isBooked: true }, { isEmergencyCancelled: true }],
        },
        include: {
          coach: {
            select: {
              id: true,
              fullName: true,
              coachProfile: {
                select: {
                  coachSpecialties: {
                    include: {
                      specialty: {
                        include: { discipline: true },
                      },
                    },
                  },
                },
              },
            },
          },
          bookings: {
            where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
            include: {
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
              attendance: true,
            },
          },
        },
      }),
    ]).then(([classes, pt]) => {
      const mappedPt = pt.map((slot) => {
        const coachSpec = (slot as any).coach?.coachProfile?.coachSpecialties?.[0]?.specialty;
        const disciplineName = coachSpec?.discipline?.name || null;
        const disciplineCode = coachSpec?.discipline?.code || null;
        const specialtyName = coachSpec?.name || null;
        const isYogaOrBoxing = Boolean(
          disciplineName?.toLowerCase().includes('yoga') ||
          disciplineName?.toLowerCase().includes('boxing') ||
          disciplineCode?.toLowerCase().includes('yoga') ||
          disciplineCode?.toLowerCase().includes('box') ||
          specialtyName?.toLowerCase().includes('yoga') ||
          specialtyName?.toLowerCase().includes('boxing')
        );
        const packageCategory = isYogaOrBoxing ? 'GROUP' : 'ONE_ON_ONE';
        return {
          ...slot,
          disciplineName,
          disciplineCode,
          specialtyName,
          packageCategory,
        };
      });
      return { classes, pt: mappedPt };
    });
  }
  members(actor: Actor, query?: string) {
    return this.prisma.userSubscription.findMany({
      where: {
        assignedCoachId: actor.userId,
        status: 'ACTIVE',
        user: query
          ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
          : undefined,
      },
      select: {
        id: true,
        disciplineId: true,
        endDate: true,
        remainingGroupSessions: true,
        remainingPtSessions: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            avatarUrl: true,
            memberProfile: true,
            memberInbodyLogs: { orderBy: { measuredAt: 'desc' }, take: 5 },
          },
        },
      },
      distinct: ['userId'],
      orderBy: { endDate: 'desc' },
      take: 200,
    });
  }

  // 1. Ngoại lệ khung giờ (Exception Slots)
  async listPendingExceptions() {
    const now = new Date();
    // Hạn chót phê duyệt của Quản lý: Trước giờ bắt đầu ca tối thiểu 1 tiếng
    const deadlineThreshold = new Date(now.getTime() + 60 * 60 * 1000);

    // Tự động hết hạn (EXPIRED) các ca PENDING đã quá hạn duyệt (còn dưới 1 tiếng trước giờ bắt đầu)
    await this.prisma.coachAvailability.updateMany({
      where: {
        approvalStatus: 'PENDING',
        startTime: { lte: deadlineThreshold },
      },
      data: {
        approvalStatus: 'EXPIRED',
        rejectionReason: 'Quá hạn phê duyệt (Hệ thống tự động hết hạn do dưới 1 tiếng trước giờ bắt đầu)',
        reviewedAt: now,
      },
    });

    return this.prisma.coachAvailability.findMany({
      where: {
        approvalStatus: 'PENDING',
        isEmergencyCancelled: false,
        startTime: { gt: deadlineThreshold },
      },
      include: {
        coach: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async reviewException(id: string, dto: ReviewExceptionDto, actor: Actor) {
    const isApprove = dto.action === 'APPROVE';
    const existing = await this.prisma.coachAvailability.findUnique({
      where: { id },
      include: {
        coach: { select: { id: true, fullName: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy ca ngoại lệ này.');
    }
    if (existing.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        `Ca này đã ở trạng thái ${existing.approvalStatus}, không thể thực hiện thao tác duyệt/từ chối.`,
      );
    }

    const now = new Date();
    if (isApprove && existing.startTime.getTime() - now.getTime() < 60 * 60 * 1000) {
      await this.prisma.coachAvailability.update({
        where: { id },
        data: {
          approvalStatus: 'EXPIRED',
          rejectionReason: 'Quá hạn phê duyệt (Hệ thống tự động hết hạn do dưới 1 tiếng trước giờ bắt đầu)',
          reviewedAt: now,
        },
      });
      throw new BadRequestException(
        'Ca này đã quá hạn duyệt (còn dưới 1 tiếng trước giờ bắt đầu). Hệ thống đã tự động chuyển sang trạng thái Hết hạn.',
      );
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { fullName: true },
    });

    const slot = await this.prisma.coachAvailability.update({
      where: { id },
      data: {
        approvalStatus: isApprove ? 'APPROVED' : 'REJECTED',
        approvedById: isApprove ? actor.userId : null,
        approvedByName: isApprove ? (actorUser?.fullName || 'Quản lý') : null,
        rejectionReason: !isApprove
          ? dto.rejectionReason || 'Quản lý không phê duyệt'
          : null,
        reviewedAt: now,
      },
    });

    // Phát sự kiện SSE để HLV, Manager và Member đồng bộ trạng thái ca tập
    this.events.publish({
      name: isApprove ? 'slot.approved' : 'slot.rejected',
      roles: ['COACH', 'MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        slotId: slot.id,
        coachId: slot.coachId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        action: dto.action,
        reason: slot.rejectionReason,
        approvedByName: slot.approvedByName,
      },
    });

    return slot;
  }

  // 2. Ca trống / Ca bị hủy cần người dạy thay (Pickup Schedules - cùng bộ môn & cùng level sao)
  async pickupSchedules(actor: Actor) {
    const specs = await this.prisma.coachSpecialty.findMany({
      where: { coachProfile: { userId: actor.userId } },
      include: { specialty: true },
    });
    const disciplineIds = Array.from(
      new Set(specs.map((s) => s.specialty.disciplineId)),
    );
    const specialtyCodes = new Set(
      specs.map((s) => s.specialty?.code).filter(Boolean),
    );

    const coachRates = await this.prisma.coachRate.findMany({
      where: { coachId: actor.userId },
      select: { disciplineId: true },
    });
    for (const r of coachRates) {
      if (r.disciplineId && !disciplineIds.includes(r.disciplineId)) {
        disciplineIds.push(r.disciplineId);
      }
    }

    if (disciplineIds.length === 0) return [];

    const actorProfile = await this.prisma.coachProfile.findUnique({
      where: { userId: actor.userId },
      select: { ratingStars: true },
    });
    const actorStars = actorProfile?.ratingStars ?? 2;

    const now = new Date();
    const openRequests = await this.prisma.cancellationRequest.findMany({
      where: {
        coachId: { not: actor.userId },
        status: { in: ['PENDING', 'APPROVED'] },
        substitutionStatus: { not: 'ACCEPTED' },
        NOT: {
          AND: [
            { substituteCoachId: actor.userId },
            { substitutionStatus: 'PENDING_ACCEPTANCE' },
          ],
        },
        OR: [
          { substituteCoachId: null },
          {
            substitutionStatus: {
              in: ['NONE', 'NEEDS_SUBSTITUTE', 'DECLINED', 'PENDING_ACCEPTANCE'],
            },
          },
        ],
      },
      include: {
        coach: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            coachProfile: { select: { ratingStars: true } },
          },
        },
        schedule: {
          include: {
            class: { include: { discipline: true } },
            room: true,
          },
        },
        booking: {
          include: {
            coachAvailability: true,
            discipline: true,
            subscription: {
              include: {
                plan: { include: { discipline: true, room: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const myBusySchedules = await this.prisma.schedule.findMany({
      where: {
        coachId: actor.userId,
        startTime: { gt: now },
        status: { in: ['OPEN', 'FULL'] },
      },
      select: { startTime: true, endTime: true },
    });

    const myBusySlots = await this.prisma.coachAvailability.findMany({
      where: {
        coachId: actor.userId,
        startTime: { gt: now },
        isBooked: true,
        isEmergencyCancelled: false,
      },
      select: { startTime: true, endTime: true },
    });

    const results: any[] = [];
    for (const req of openRequests) {
      if (req.substitutionStatus === 'ACCEPTED' || req.substitutionStatus === 'EXPIRED') {
        continue;
      }
      if (req.schedule && req.schedule.coachId !== req.coachId) {
        continue;
      }
      if (req.booking?.coachAvailability && req.booking.coachAvailability.coachId !== req.coachId) {
        continue;
      }
      const startTime = req.schedule?.startTime ?? req.booking?.coachAvailability?.startTime;
      const endTime = req.schedule?.endTime ?? req.booking?.coachAvailability?.endTime;
      if (!startTime || !endTime || startTime <= now) continue;

      const reqCoachStars = req.coach?.coachProfile?.ratingStars ?? 2;
      if (reqCoachStars !== actorStars) continue;

      const discId =
        req.schedule?.class?.disciplineId ??
        req.booking?.disciplineId ??
        req.booking?.subscription?.plan?.disciplineId;
      if (discId && !disciplineIds.includes(discId)) continue;

      const planName =
        req.schedule?.class?.name ??
        req.booking?.subscription?.plan?.name ??
        (req.targetType === 'GROUP_CLASS' ? 'Lớp tập nhóm' : 'Buổi tập PT 1-1');
      const disciplineObj =
        req.schedule?.class?.discipline ??
        req.booking?.discipline ??
        req.booking?.subscription?.plan?.discipline ??
        null;

      if (req.targetType === 'GROUP_CLASS') {
        const classSpec = getClassSpecialtyCode(
          planName,
          disciplineObj?.code,
        );
        if (classSpec && specialtyCodes.size > 0 && !specialtyCodes.has(classSpec)) {
          continue;
        }
      }

      const hasOverlap =
        myBusySchedules.some((s) => s.startTime < endTime && s.endTime > startTime) ||
        myBusySlots.some((s) => s.startTime < endTime && s.endTime > startTime);
      if (hasOverlap) continue;

      const resolvedRoom =
        req.schedule?.room ??
        req.booking?.subscription?.plan?.room ?? {
          name:
            req.targetType === 'GROUP_CLASS'
              ? getSpecialtyDedicatedRoomName(planName, disciplineObj?.code)
              : 'Khu vực PT kèm riêng',
        };

      results.push({
        id: req.scheduleId ?? req.id,
        cancellationRequestId: req.id,
        startTime,
        endTime,
        class: req.schedule?.class ?? { name: planName, discipline: disciplineObj },
        room: resolvedRoom,
        coach: req.coach,
        cancellationRequests: [req],
      });
    }

    return results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async applyPickupSchedule(idOrScheduleId: string, actor: Actor) {
    const req = await this.prisma.cancellationRequest.findFirst({
      where: {
        OR: [{ id: idOrScheduleId }, { scheduleId: idOrScheduleId }],
        status: { in: ['PENDING', 'APPROVED'] },
        substitutionStatus: { notIn: ['ACCEPTED', 'EXPIRED'] },
      },
      include: {
        coach: { include: { coachProfile: true } },
        schedule: { include: { class: true } },
        booking: { include: { coachAvailability: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!req) throw new NotFoundException('REQUEST_NOT_FOUND');
    if (req.coachId === actor.userId) {
      throw new BadRequestException('CANNOT_PICKUP_OWN_SESSION');
    }
    if (
      (req.schedule && req.schedule.coachId !== req.coachId) ||
      (req.booking?.coachAvailability && req.booking.coachAvailability.coachId !== req.coachId)
    ) {
      throw new ConflictException('CA_ALREADY_ASSIGNED');
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        fullName: true,
        coachProfile: {
          select: {
            ratingStars: true,
            coachSpecialties: { include: { specialty: true } },
          },
        },
        coachRates: { select: { disciplineId: true } },
      },
    });
    const actorName = actorUser?.fullName || 'HLV';
    const actorStars = actorUser?.coachProfile?.ratingStars ?? 2;
    const reqStars = req.coach?.coachProfile?.ratingStars ?? 2;
    if (actorStars !== reqStars) {
      throw new BadRequestException('SUBSTITUTE_COACH_RATING_MISMATCH');
    }

    const startTime =
      req.schedule?.startTime ?? req.booking?.coachAvailability?.startTime;
    const endTime =
      req.schedule?.endTime ?? req.booking?.coachAvailability?.endTime;
    if (!startTime || !endTime || startTime <= new Date()) {
      throw new BadRequestException('SCHEDULE_ALREADY_STARTED');
    }

    if (req.schedule?.class) {
      const classSpec = getClassSpecialtyCode(
        req.schedule.class.name || '',
        (req.schedule.class as any).discipline?.code,
      );
      const actorSpecCodes = new Set(
        (actorUser?.coachProfile?.coachSpecialties ?? [])
          .map((cs) => cs.specialty?.code)
          .filter(Boolean),
      );
      if (classSpec && actorSpecCodes.size > 0 && !actorSpecCodes.has(classSpec)) {
        throw new BadRequestException('SUBSTITUTE_COACH_DISCIPLINE_MISMATCH');
      }
    }

    const [scheduleOverlap, slotOverlap] = await Promise.all([
      this.prisma.schedule.findFirst({
        where: {
          ...(req.schedule ? { id: { not: req.schedule.id } } : {}),
          coachId: actor.userId,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          status: { in: ['OPEN', 'FULL'] },
        },
        select: { id: true },
      }),
      this.prisma.coachAvailability.findFirst({
        where: {
          coachId: actor.userId,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          isBooked: true,
          isEmergencyCancelled: false,
        },
        select: { id: true },
      }),
    ]);
    if (scheduleOverlap || slotOverlap) {
      throw new ConflictException('SUBSTITUTE_COACH_SCHEDULE_OVERLAP');
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cancellationRequest.updateMany({
        where: {
          id: req.id,
          status: { in: ['PENDING', 'APPROVED'] },
          substitutionStatus: { notIn: ['ACCEPTED', 'EXPIRED'] },
          OR: [
            { substituteCoachId: null },
            {
              substitutionStatus: {
                in: ['NONE', 'NEEDS_SUBSTITUTE', 'DECLINED', 'PENDING_ACCEPTANCE'],
              },
            },
          ],
        },
        data: {
          status: 'APPROVED',
          reviewedAt: req.reviewedAt ?? new Date(),
          substituteCoachId: actor.userId,
          substituteCoachName: actorName,
          substitutionStatus: 'ACCEPTED',
          substitutionRespondedAt: new Date(),
          internalNote: `HLV ${actorName} đã nhận dạy thay và được bàn giao ca trực tiếp.`,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('CA_ALREADY_ASSIGNED');
      }

      if (req.scheduleId && req.schedule) {
        await tx.schedule.update({
          where: { id: req.scheduleId },
          data: {
            coachId: actor.userId,
            coach_name: actorName,
            status:
              req.schedule.currentEnrolled >= req.schedule.capacity
                ? 'FULL'
                : 'OPEN',
          },
        });
      } else if (req.booking?.coachAvailabilityId) {
        await tx.coachAvailability.update({
          where: { id: req.booking.coachAvailabilityId },
          data: {
            coachId: actor.userId,
            coach_name: actorName,
            isEmergencyCancelled: false,
            isBooked: true,
          },
        });
      }

      if (req.bookingId) {
        await tx.workoutPlan.updateMany({
          where: { bookingId: req.bookingId },
          data: { coachId: actor.userId },
        });
      }

      // Close any other open requests on the same schedule/booking so no coach sees duplicates
      if (req.scheduleId || req.bookingId) {
        await tx.cancellationRequest.updateMany({
          where: {
            id: { not: req.id },
            ...(req.scheduleId
              ? { scheduleId: req.scheduleId }
              : { bookingId: req.bookingId! }),
            status: { in: ['PENDING', 'APPROVED'] },
            substitutionStatus: { not: 'ACCEPTED' },
          },
          data: {
            status: 'APPROVED',
            substitutionStatus: 'EXPIRED',
          },
        });
      }
    });

    this.events.publish({
      name: 'substitution.responded',
      userIds: [req.coachId, actor.userId],
      roles: ['COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        requestId: req.id,
        scheduleId: req.scheduleId,
        bookingId: req.bookingId,
        substituteCoachId: actor.userId,
        substituteCoachName: actorName,
        status: 'ACCEPTED',
        handoverImmediate: true,
      },
    });
    this.events.publish({
      name: 'schedule.updated',
      userIds: [req.coachId, actor.userId],
      roles: ['COACH', 'CENTER_MANAGER', 'RECEPTIONIST', 'MEMBER'],
      data: {
        scheduleId: req.scheduleId,
        bookingId: req.bookingId,
        substituteCoachId: actor.userId,
        substituteCoachName: actorName,
        substitutionStatus: 'ACCEPTED',
      },
    });

    return {
      success: true,
      requestId: req.id,
      message: 'Đã nhận dạy thay thành công! Ca dạy đã được bàn giao trực tiếp vào lịch của bạn.',
    };
  }

  // Lời mời dạy thay gửi đến HLV
  async substitutionRequests(actor: Actor) {
    const now = new Date();
    const list = await this.prisma.cancellationRequest.findMany({
      where: {
        substituteCoachId: actor.userId,
        status: { in: ['PENDING', 'APPROVED'] },
        substitutionStatus: 'PENDING_ACCEPTANCE',
        OR: [
          {
            schedule: {
              startTime: { gt: now },
            },
          },
          {
            booking: {
              coachAvailability: {
                startTime: { gt: now },
              },
            },
          },
        ],
      },
      include: {
        schedule: {
          include: {
            class: { include: { discipline: true } },
            room: true,
          },
        },
        booking: {
          include: {
            discipline: true,
            coachAvailability: true,
            member: { select: { id: true, fullName: true } },
            subscription: { include: { plan: { include: { room: true } } } },
          },
        },
        coach: {
          select: { id: true, fullName: true, phone: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.filter((req) => {
      if (req.schedule && req.schedule.coachId !== req.coachId) return false;
      if (req.booking?.coachAvailability && req.booking.coachAvailability.coachId !== req.coachId) {
        return false;
      }
      return true;
    });
  }

  async respondSubstitutionRequest(
    requestId: string,
    dto: RespondSubstitutionDto,
    actor: Actor,
  ) {
    const req = await this.prisma.cancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        schedule: { include: { class: true } },
        booking: {
          include: {
            discipline: true,
            coachAvailability: true,
            member: { select: { fullName: true } },
          },
        },
      },
    });
    if (!req) throw new NotFoundException('REQUEST_NOT_FOUND');
    if (req.substituteCoachId !== actor.userId) {
      throw new ForbiddenException('NOT_ASSIGNED_TO_THIS_COACH');
    }
    if (req.substitutionStatus !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestException('REQUEST_ALREADY_RESPONDED');
    }

    const sessionStart =
      req.schedule?.startTime ?? req.booking?.coachAvailability?.startTime;
    const sessionEnd =
      req.schedule?.endTime ?? req.booking?.coachAvailability?.endTime;
    if (!sessionStart || !sessionEnd || sessionStart <= new Date()) {
      throw new BadRequestException('SCHEDULE_ALREADY_STARTED');
    }

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { fullName: true },
    });
    const coachName = actorUser?.fullName || 'HLV';
    const sessionLabel = req.schedule
      ? req.schedule.class?.name || 'lớp nhóm'
      : req.booking?.bookingType === 'GROUP_CLASS'
        ? `lớp nhóm ${req.booking?.discipline?.name || ''}`.trim()
        : `buổi PT 1-1 (${req.booking?.member?.fullName || 'học viên'})`;

    if (dto.action === 'ACCEPT') {
      const [scheduleOverlap, slotOverlap] = await Promise.all([
        this.prisma.schedule.findFirst({
          where: {
            ...(req.schedule ? { id: { not: req.schedule.id } } : {}),
            coachId: actor.userId,
            startTime: { lt: sessionEnd },
            endTime: { gt: sessionStart },
            status: { in: ['OPEN', 'FULL'] },
          },
        }),
        this.prisma.coachAvailability.findFirst({
          where: {
            ...(req.booking?.coachAvailability
              ? { id: { not: req.booking.coachAvailability.id } }
              : {}),
            coachId: actor.userId,
            isBooked: true,
            isEmergencyCancelled: false,
            startTime: { lt: sessionEnd },
            endTime: { gt: sessionStart },
          },
        }),
      ]);
      if (scheduleOverlap || slotOverlap) {
        throw new ConflictException('SUBSTITUTE_COACH_SCHEDULE_OVERLAP');
      }

      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.cancellationRequest.updateMany({
          where: {
            id: req.id,
            substituteCoachId: actor.userId,
            substitutionStatus: 'PENDING_ACCEPTANCE',
          },
          data: {
            status: 'APPROVED',
            reviewedAt: req.reviewedAt ?? new Date(),
            substitutionStatus: 'ACCEPTED',
            substitutionRespondedAt: new Date(),
            internalNote: `HLV ${coachName} đã ĐỒNG Ý nhận dạy thay ca này. Ca dạy đã được bàn giao trực tiếp.`,
          },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('REQUEST_ALREADY_RESPONDED');
        }

        if (req.schedule) {
          await tx.schedule.update({
            where: { id: req.schedule.id },
            data: {
              coachId: actor.userId,
              coach_name: coachName,
              status:
                req.schedule.currentEnrolled >= req.schedule.capacity
                  ? 'FULL'
                  : 'OPEN',
            },
          });
        } else if (req.booking?.coachAvailability) {
          await tx.coachAvailability.update({
            where: { id: req.booking.coachAvailability.id },
            data: {
              coachId: actor.userId,
              coach_name: coachName,
              isEmergencyCancelled: false,
              isBooked: true,
            },
          });
        }

        if (req.bookingId) {
          await tx.workoutPlan.updateMany({
            where: { bookingId: req.bookingId },
            data: { coachId: actor.userId },
          });
        }

        if (req.scheduleId || req.bookingId) {
          await tx.cancellationRequest.updateMany({
            where: {
              id: { not: req.id },
              ...(req.scheduleId
                ? { scheduleId: req.scheduleId }
                : { bookingId: req.bookingId! }),
              status: { in: ['PENDING', 'APPROVED'] },
              substitutionStatus: { not: 'ACCEPTED' },
            },
            data: {
              status: 'APPROVED',
              substitutionStatus: 'EXPIRED',
            },
          });
        }
      });

      this.events.publish({
        name: 'substitution.responded',
        userIds: [req.coachId, actor.userId],
        roles: ['COACH', 'CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          requestId: req.id,
          scheduleId: req.scheduleId,
          bookingId: req.bookingId,
          substituteCoachId: actor.userId,
          substituteCoachName: coachName,
          status: 'ACCEPTED',
          handoverImmediate: true,
        },
      });
      this.events.publish({
        name: 'schedule.updated',
        userIds: [req.coachId, actor.userId],
        roles: ['COACH', 'CENTER_MANAGER', 'RECEPTIONIST', 'MEMBER'],
        data: {
          scheduleId: req.scheduleId,
          bookingId: req.bookingId,
          substituteCoachId: actor.userId,
          substituteCoachName: coachName,
          substitutionStatus: 'ACCEPTED',
        },
      });

      return {
        success: true,
        status: 'ACCEPTED',
        message: `Bạn đã đồng ý nhận dạy thay ca ${sessionLabel}. Lịch dạy đã được cập nhật thành công.`,
      };
    } else {
      await this.prisma.cancellationRequest.update({
        where: { id: req.id },
        data: {
          substitutionStatus: 'DECLINED',
          substitutionDeclinedReason: dto.reason || 'HLV bận không thể nhận ca này',
          substitutionRespondedAt: new Date(),
          internalNote: `HLV ${coachName} đã TỪ CHỐI ca dạy thay. Lý do: ${dto.reason || 'Bận việc'}`,
        },
      });

      this.events.publish({
        name: 'substitution.responded',
        userIds: [req.coachId],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          requestId: req.id,
          scheduleId: req.scheduleId,
          bookingId: req.bookingId,
          substituteCoachId: actor.userId,
          substituteCoachName: coachName,
          status: 'DECLINED',
          reason: dto.reason || 'HLV bận không thể nhận ca này',
        },
      });

      return {
        success: true,
        status: 'DECLINED',
        message: `Bạn đã từ chối nhận ca dạy thay. Hệ thống đã thông báo lại cho Quản lý.`,
      };
    }
  }

  async reassignSubstitute(
    requestId: string,
    dto: ReassignSubstituteDto,
    _actor: Actor,
  ) {
    const req = await this.prisma.cancellationRequest.findUnique({
      where: { id: requestId },
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
        schedule: { include: { class: true } },
        booking: {
          include: {
            coachAvailability: true,
            discipline: true,
            subscription: { include: { plan: true } },
          },
        },
      },
    });
    if (!req) throw new NotFoundException('REQUEST_NOT_FOUND');

    const startTime =
      req.schedule?.startTime ?? req.booking?.coachAvailability?.startTime;
    const endTime =
      req.schedule?.endTime ?? req.booking?.coachAvailability?.endTime;
    if (!startTime || !endTime || startTime <= new Date()) {
      throw new BadRequestException('SCHEDULE_ALREADY_STARTED');
    }

    if (dto.substituteCoachId === req.coachId) {
      throw new BadRequestException('CANNOT_ASSIGN_SELF_AS_SUBSTITUTE');
    }

    const subCoach = await this.prisma.user.findUnique({
      where: { id: dto.substituteCoachId, role: UserRole.COACH, isActive: true },
      include: {
        coachProfile: {
          include: {
            coachSpecialties: { include: { specialty: true } },
          },
        },
        coachRates: true,
      },
    });
    if (!subCoach) throw new NotFoundException('SUBSTITUTE_COACH_NOT_FOUND');

    const reqStars = req.coach?.coachProfile?.ratingStars ?? 2;
    const subStars = subCoach.coachProfile?.ratingStars ?? 2;
    if (reqStars !== subStars) {
      throw new BadRequestException('SUBSTITUTE_COACH_RATING_MISMATCH');
    }

    const sessionDisciplineId =
      req.schedule?.class?.disciplineId ??
      req.booking?.disciplineId ??
      req.booking?.subscription?.plan?.disciplineId;

    const reqDiscIds = new Set(
      (req.coach?.coachProfile?.coachSpecialties ?? [])
        .map((cs) => cs.specialty?.disciplineId)
        .filter(Boolean),
    );
    const subDiscIds = new Set([
      ...(subCoach.coachProfile?.coachSpecialties ?? [])
        .map((cs) => cs.specialty?.disciplineId)
        .filter(Boolean),
      ...(subCoach.coachRates ?? []).map((r) => r.disciplineId).filter(Boolean),
    ]);

    const matchesDiscipline = sessionDisciplineId
      ? subDiscIds.has(sessionDisciplineId)
      : [...reqDiscIds].some((id) => subDiscIds.has(id));

    if (!matchesDiscipline) {
      throw new BadRequestException('SUBSTITUTE_COACH_DISCIPLINE_MISMATCH');
    }

    const [scheduleOverlap, slotOverlap] = await Promise.all([
      this.prisma.schedule.findFirst({
        where: {
          ...(req.schedule ? { id: { not: req.schedule.id } } : {}),
          coachId: subCoach.id,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          status: { in: ['OPEN', 'FULL'] },
        },
      }),
      this.prisma.coachAvailability.findFirst({
        where: {
          coachId: subCoach.id,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          isBooked: true,
          isEmergencyCancelled: false,
        },
      }),
    ]);
    if (scheduleOverlap || slotOverlap) {
      throw new ConflictException('SUBSTITUTE_COACH_SCHEDULE_OVERLAP');
    }

    const updated = await this.prisma.cancellationRequest.update({
      where: { id: requestId },
      data: {
        substituteCoachId: subCoach.id,
        substituteCoachName: subCoach.fullName,
        substitutionStatus: 'PENDING_ACCEPTANCE',
        substitutionDeclinedReason: null,
        substitutionRespondedAt: null,
        internalNote: `Quản lý đã gán lại và gửi lời mời dạy thay cho HLV ${subCoach.fullName}.`,
      },
    });

    this.events.publish({
      name: 'substitution.invited',
      userIds: [subCoach.id, req.coachId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        requestId: updated.id,
        scheduleId: req.scheduleId,
        bookingId: req.bookingId,
        substituteCoachId: subCoach.id,
        substituteCoachName: subCoach.fullName,
        substitutionStatus: 'PENDING_ACCEPTANCE',
      },
    });

    return updated;
  }

  /**
   * Lọc danh sách HLV phù hợp & đang RẢNH (available) để Manager gán dạy thay cho cả Lớp nhóm & PT 1-1:
   * - Cùng hạng sao (ratingStars)
   * - Cùng bộ môn / chuyên đề (disciplineId & classSpec)
   * - Trong ca thời gian nền cố định của HLV (CoachProfile workingDays/workingHours) hoặc StaffShift
   * - Không bị trùng lịch Schedule (OPEN/FULL) hoặc PT đã book
   */
  async eligibleSubstitutesForRequest(requestId: string) {
    const req = await this.prisma.cancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        coach: {
          include: {
            coachProfile: {
              include: { coachSpecialties: { include: { specialty: true } } },
            },
          },
        },
        schedule: { include: { class: { include: { discipline: true } } } },
        booking: {
          include: {
            coachAvailability: true,
            discipline: true,
            subscription: { include: { plan: true } },
          },
        },
      },
    });
    if (!req) return [];

    const startTime =
      req.schedule?.startTime ?? req.booking?.coachAvailability?.startTime;
    const endTime =
      req.schedule?.endTime ?? req.booking?.coachAvailability?.endTime;
    if (!startTime || !endTime) return [];

    const reqStars = req.coach?.coachProfile?.ratingStars ?? 2;
    const sessionDisciplineId =
      req.schedule?.class?.disciplineId ??
      req.booking?.disciplineId ??
      req.booking?.subscription?.plan?.disciplineId;
    const classSpec = req.schedule?.class
      ? getClassSpecialtyCode(
          req.schedule.class.name || '',
          req.schedule.class.discipline?.code,
        )
      : null;

    const allCoaches = await this.prisma.user.findMany({
      where: {
        role: UserRole.COACH,
        isActive: true,
        id: {
          notIn: [
            req.coachId,
            ...(req.substituteCoachId ? [req.substituteCoachId] : []),
          ],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        coachProfile: {
          select: {
            ratingStars: true,
            workingDays: true,
            workingHours: true,
            coachSpecialties: {
              include: { specialty: true },
            },
          },
        },
        coachRates: {
          select: { disciplineId: true },
        },
      },
    });

    const filtered = allCoaches.filter((c) => {
      const cStars = c.coachProfile?.ratingStars ?? 2;
      if (cStars !== reqStars) return false;

      const cSpecs = c.coachProfile?.coachSpecialties ?? [];
      const cSpecCodes = new Set(
        cSpecs.map((cs) => cs.specialty?.code).filter(Boolean),
      );
      const cDiscIds = new Set([
        ...cSpecs.map((cs) => cs.specialty?.disciplineId).filter(Boolean),
        ...(c.coachRates ?? []).map((r) => r.disciplineId).filter(Boolean),
      ]);

      if (classSpec && cSpecCodes.size > 0 && !cSpecCodes.has(classSpec)) {
        return false;
      }
      if (sessionDisciplineId && cDiscIds.size > 0 && !cDiscIds.has(sessionDisciplineId)) {
        return false;
      }
      return true;
    });

    const available: any[] = [];
    for (const c of filtered) {
      const inProfileHours = isWithinCoachProfileSchedule(
        c.coachProfile,
        startTime,
        endTime,
      );
      if (!inProfileHours) {
        const shift = await this.prisma.staffShift.findFirst({
          where: {
            staffId: c.id,
            startTime: { lte: startTime },
            endTime: { gte: endTime },
          },
          select: { id: true },
        });
        if (!shift) continue;
      }

      const [scheduleOverlap, slotOverlap] = await Promise.all([
        this.prisma.schedule.findFirst({
          where: {
            coachId: c.id,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            status: { in: ['OPEN', 'FULL'] },
          },
          select: { id: true },
        }),
        this.prisma.coachAvailability.findFirst({
          where: {
            coachId: c.id,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            isBooked: true,
            isEmergencyCancelled: false,
          },
          select: { id: true },
        }),
      ]);

      if (!scheduleOverlap && !slotOverlap) {
        available.push(c);
      }
    }

    return available;
  }

  // 3. Thống kê số ca dạy trong chu kỳ (ngày 20 tháng trước đến ngày 20 tháng này) & Thanh toán cho Coach
  async getPayoutSummary(monthInput?: string) {
    const now = new Date();
    const month =
      monthInput ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, mStr] = month.split('-');
    const year = Number(yearStr);
    const m = Number(mStr);
    // Quy định chu kỳ tính lương: từ ngày 20 tháng trước đến ngày 20 tháng hiện tại
    const startMonth = new Date(year, m - 2, 20, 0, 0, 0);
    const endMonth = new Date(year, m - 1, 20, 23, 59, 59, 999);

    const coaches = await this.prisma.user.findMany({
      where: { role: UserRole.COACH, isActive: true },
      include: {
        coachProfile: true,
        coachRates: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
      orderBy: { fullName: 'asc' },
    });

    const existingPayouts = await this.prisma.coachPayout.findMany({
      where: { month },
    });
    const payoutMap = new Map(existingPayouts.map((p) => [p.coachId, p]));

    // Batch query group class counts for all coaches (chỉ tính ca đã hoàn thành / có điểm danh ATTENDED/PRESENT)
    const coachIds = coaches.map((c) => c.id);
    const attendedGroupSchedules = await this.prisma.schedule.findMany({
      where: {
        coachId: { in: coachIds },
        startTime: { gte: startMonth, lte: endMonth },
        status: { not: 'CANCELLED_BY_COACH' },
        OR: [
          { status: 'COMPLETED' },
          {
            bookings: {
              some: {
                OR: [
                  { status: 'ATTENDED' },
                  { attendance: { status: { in: ['PRESENT', 'LATE'] } } },
                ],
              },
            },
          },
        ],
      },
      select: { coachId: true },
    });
    const groupCountMap = new Map<string, number>();
    for (const s of attendedGroupSchedules) {
      groupCountMap.set(s.coachId, (groupCountMap.get(s.coachId) || 0) + 1);
    }

    // Batch query PT bookings (chỉ tính ca PT đã điểm danh ATTENDED/PRESENT)
    const ptBookings = await this.prisma.booking.findMany({
      where: {
        coachAvailability: {
          coachId: { in: coachIds },
          startTime: { gte: startMonth, lte: endMonth },
        },
        bookingType: 'PERSONAL_TRAINING',
        OR: [
          { status: 'ATTENDED' },
          { attendance: { status: { in: ['PRESENT', 'LATE'] } } },
        ],
      },
      select: {
        coachAvailability: { select: { coachId: true } },
      },
    });
    const ptCountMap = new Map<string, number>();
    for (const b of ptBookings) {
      const cId = b.coachAvailability?.coachId;
      if (cId) {
        ptCountMap.set(cId, (ptCountMap.get(cId) || 0) + 1);
      }
    }

    const results = [];
    for (const c of coaches) {
      const groupCount = groupCountMap.get(c.id) || 0;
      const ptCount = ptCountMap.get(c.id) || 0;

      const totalSessions = groupCount + ptCount;
      const rate = Number(c.coachRates[0]?.ratePerSession || 250000);
      const totalAmount = totalSessions * rate;
      const existing = payoutMap.get(c.id);

      results.push({
        coachId: c.id,
        coachName: c.fullName,
        email: c.email,
        phone: c.phone,
        month,
        bankName: existing?.bankName || c.coachProfile?.bankName || null,
        bankAccountNumber:
          existing?.bankAccountNumber ||
          c.coachProfile?.bankAccountNumber ||
          null,
        bankAccountName:
          existing?.bankAccountName ||
          c.coachProfile?.bankAccountName ||
          c.fullName,
        groupSessionCount: groupCount,
        ptSessionCount: ptCount,
        totalSessions,
        ratePerSession: rate,
        totalAmount,
        status: existing?.status || 'UNPAID',
        paidAt: existing?.paidAt || null,
        paidByName: existing?.paidByName || null,
        paymentNote: existing?.paymentNote || null,
        receiptUrl: existing?.receiptUrl || null,
      });
    }

    return results;
  }

  async payCoach(
    coachId: string,
    month: string,
    actor: Actor,
    note?: string,
    receiptUrl?: string,
  ) {
    const summaryList = await this.getPayoutSummary(month);
    const coachSummary = summaryList.find((s) => s.coachId === coachId);
    if (!coachSummary) throw new NotFoundException('COACH_NOT_FOUND');

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { fullName: true },
    });
    const actorName = actorUser?.fullName || 'Quản lý';

    const payout = await this.prisma.coachPayout.upsert({
      where: {
        coachId_month: { coachId, month },
      },
      update: {
        status: 'PAID',
        paidAt: new Date(),
        paidById: actor.userId,
        paidByName: actorName,
        paymentNote:
          note || 'Đã quyết toán chuyển khoản qua tài khoản ngân hàng',
        receiptUrl: receiptUrl || null,
        groupSessionCount: coachSummary.groupSessionCount,
        ptSessionCount: coachSummary.ptSessionCount,
        totalSessions: coachSummary.totalSessions,
        ratePerSession: coachSummary.ratePerSession,
        totalAmount: coachSummary.totalAmount,
        bankName: coachSummary.bankName,
        bankAccountNumber: coachSummary.bankAccountNumber,
        bankAccountName: coachSummary.bankAccountName,
      },
      create: {
        coachId,
        coachName: coachSummary.coachName,
        month,
        status: 'PAID',
        paidAt: new Date(),
        paidById: actor.userId,
        paidByName: actorName,
        paymentNote:
          note || 'Đã quyết toán chuyển khoản qua tài khoản ngân hàng',
        receiptUrl: receiptUrl || null,
        groupSessionCount: coachSummary.groupSessionCount,
        ptSessionCount: coachSummary.ptSessionCount,
        totalSessions: coachSummary.totalSessions,
        ratePerSession: coachSummary.ratePerSession,
        totalAmount: coachSummary.totalAmount,
        bankName: coachSummary.bankName,
        bankAccountNumber: coachSummary.bankAccountNumber,
        bankAccountName: coachSummary.bankAccountName,
      },
    });

    return payout;
  }

  async getPayoutDetails(coachId: string, monthInput?: string) {
    const now = new Date();
    const month =
      monthInput ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, mStr] = month.split('-');
    const year = Number(yearStr);
    const m = Number(mStr);
    const startCycle = new Date(year, m - 2, 20, 0, 0, 0);
    const endCycle = new Date(year, m - 1, 20, 23, 59, 59, 999);

    const coach = await this.prisma.user.findUnique({
      where: { id: coachId },
      include: {
        coachProfile: true,
        coachRates: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    });
    if (!coach) throw new NotFoundException('COACH_NOT_FOUND');

    const rate = Number(coach.coachRates[0]?.ratePerSession || 250000);

    const groupSchedules = await this.prisma.schedule.findMany({
      where: {
        coachId,
        startTime: { gte: startCycle, lte: endCycle },
        status: { not: 'CANCELLED_BY_COACH' },
        OR: [
          { status: 'COMPLETED' },
          {
            bookings: {
              some: {
                OR: [
                  { status: 'ATTENDED' },
                  { attendance: { status: { in: ['PRESENT', 'LATE'] } } },
                ],
              },
            },
          },
        ],
      },
      include: {
        class: { include: { discipline: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    const ptBookings = await this.prisma.booking.findMany({
      where: {
        coachAvailability: {
          coachId,
          startTime: { gte: startCycle, lte: endCycle },
        },
        bookingType: 'PERSONAL_TRAINING',
        OR: [
          { status: 'ATTENDED' },
          { attendance: { status: { in: ['PRESENT', 'LATE'] } } },
        ],
      },
      include: {
        member: { select: { id: true, fullName: true, phone: true } },
        coachAvailability: true,
      },
      orderBy: { coachAvailability: { startTime: 'desc' } },
    });

    const sessions = [
      ...groupSchedules.map((s) => ({
        id: s.id,
        type: 'GROUP' as const,
        typeName: 'Lớp tập nhóm',
        title: s.class?.name || 'Lớp tập nhóm',
        discipline: s.class?.discipline?.name || 'Thể hình',
        startTime: s.startTime,
        endTime: s.endTime,
        studentOrClass: s.class?.name || 'Lớp tập nhóm',
        fee: rate,
        status: s.status,
      })),
      ...ptBookings.map((b) => ({
        id: b.id,
        type: 'PT' as const,
        typeName: 'Dạy kèm PT 1-1',
        title: `Buổi PT 1-1 với ${b.member?.fullName || 'Học viên'}`,
        discipline: 'Cá nhân 1-1',
        startTime: b.coachAvailability?.startTime || b.bookedAt,
        endTime: b.coachAvailability?.endTime,
        studentOrClass: b.member?.fullName || 'Học viên',
        fee: rate,
        status: b.status,
      })),
    ].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

    const totalGroup = groupSchedules.length;
    const totalPt = ptBookings.length;
    const totalSessions = totalGroup + totalPt;
    const totalAmount = totalSessions * rate;

    return {
      coachId,
      coachName: coach.fullName,
      phone: coach.phone,
      bankName: coach.coachProfile?.bankName,
      bankAccountNumber: coach.coachProfile?.bankAccountNumber,
      bankAccountName: coach.coachProfile?.bankAccountName || coach.fullName,
      month,
      cycleRange: `${startCycle.toLocaleDateString('vi-VN')} - ${endCycle.toLocaleDateString('vi-VN')}`,
      ratePerSession: rate,
      totalGroup,
      totalPt,
      totalSessions,
      totalAmount,
      sessions,
    };
  }

  async createTopicRequest(
    dto: { specialtyId: string; reason: string; certificateUrl?: string },
    actor: Actor,
  ) {
    const coachId = actor.userId;
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: { coachSpecialties: true },
    });
    if (!profile) {
      throw new BadRequestException('Hồ sơ Huấn luyện viên không tồn tại.');
    }

    const alreadyHas = profile.coachSpecialties.some((cs) => cs.specialtyId === dto.specialtyId);
    if (alreadyHas) {
      throw new BadRequestException('Bạn đã được cấp phép giảng dạy chuyên đề này rồi.');
    }

    // Cross-discipline restriction:
    // Coach Gym cannot request Yoga or Boxing; conversely Coach Yoga/Boxing cannot request PT Gym.
    const targetSpecialty = await this.prisma.specialty.findUnique({
      where: { id: dto.specialtyId },
      include: { discipline: true },
    });
    if (!targetSpecialty) {
      throw new BadRequestException('Chuyên đề không tồn tại.');
    }
    const targetCode = targetSpecialty.discipline?.code?.toUpperCase();

    const coachSpecialties = await this.prisma.coachSpecialty.findMany({
      where: { coachProfileId: profile.id },
      include: { specialty: { include: { discipline: true } } },
    });
    const coachRates = await this.prisma.coachRate.findMany({
      where: { coachId },
      include: { discipline: true },
    });
    const currentDisciplineCodes = new Set<string>();
    coachSpecialties.forEach((cs) => {
      if (cs.specialty?.discipline?.code) {
        currentDisciplineCodes.add(cs.specialty.discipline.code.toUpperCase());
      }
    });
    coachRates.forEach((cr) => {
      if (cr.discipline?.code) {
        currentDisciplineCodes.add(cr.discipline.code.toUpperCase());
      }
    });
    if (profile.specialties) {
      const sUpper = profile.specialties.toUpperCase();
      if (sUpper.includes('GYM')) currentDisciplineCodes.add('GYM');
      if (sUpper.includes('YOGA')) currentDisciplineCodes.add('YOGA');
      if (sUpper.includes('BOXING')) currentDisciplineCodes.add('BOXING');
    }

    for (const curDisc of currentDisciplineCodes) {
      if (curDisc && targetCode && curDisc !== targetCode) {
        throw new BadRequestException(
          `Huấn luyện viên thuộc bộ môn ${curDisc} chỉ được đăng ký chuyên đề thuộc bộ môn ${curDisc} (không được đăng ký chéo sang ${targetCode}).`,
        );
      }
    }

    const pending = await (this.prisma as any).coachTopicRequest.findFirst({
      where: {
        coachId,
        specialtyId: dto.specialtyId,
        status: 'PENDING',
      },
    });
    if (pending) {
      throw new BadRequestException('Bạn đã có yêu cầu cho chuyên đề này đang chờ xét duyệt.');
    }

    return (this.prisma as any).coachTopicRequest.create({
      data: {
        coachId,
        specialtyId: dto.specialtyId,
        reason: dto.reason,
        certificateUrl: dto.certificateUrl,
        status: 'PENDING',
      },
      include: { specialty: { include: { discipline: true } } },
    });
  }

  async listTopicRequests(actor: Actor, status?: string) {
    const isCoach = actor.role === UserRole.COACH;
    return (this.prisma as any).coachTopicRequest.findMany({
      where: {
        ...(isCoach ? { coachId: actor.userId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        coach: { select: { id: true, fullName: true, email: true, phone: true } },
        specialty: { include: { discipline: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewTopicRequest(
    id: string,
    dto: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string },
    actor: Actor,
  ) {
    const request = await (this.prisma as any).coachTopicRequest.findUnique({
      where: { id },
      include: { coach: { include: { coachProfile: true } } },
    });
    if (!request) {
      throw new BadRequestException('Yêu cầu không tồn tại.');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Yêu cầu này đã được xử lý trước đó.');
    }

    const isApprove = dto.action === 'APPROVE';
    if (isApprove && request.coach.coachProfile) {
      const targetSpec = await this.prisma.specialty.findUnique({
        where: { id: request.specialtyId },
        include: { discipline: true },
      });
      const targetCode = targetSpec?.discipline?.code?.toUpperCase();
      const existingSpecs = await this.prisma.coachSpecialty.findMany({
        where: { coachProfileId: request.coach.coachProfile.id },
        include: { specialty: { include: { discipline: true } } },
      });
      const existingCodes = new Set(
        existingSpecs
          .map((cs) => cs.specialty?.discipline?.code?.toUpperCase())
          .filter(Boolean),
      );
      for (const curDisc of existingCodes) {
        if (curDisc && targetCode && curDisc !== targetCode) {
          throw new BadRequestException(
            `Không thể duyệt chuyên đề khác bộ môn (HLV thuộc bộ môn ${curDisc} không thể nhận chuyên đề ${targetCode}). Mỗi HLV chỉ phụ trách duy nhất 1 bộ môn.`,
          );
        }
      }
    }

    const updated = await (this.prisma as any).coachTopicRequest.update({
      where: { id },
      data: {
        status: isApprove ? 'APPROVED' : 'REJECTED',
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        rejectionReason: !isApprove ? dto.rejectionReason || 'Quản lý từ chối yêu cầu' : null,
      },
      include: {
        coach: { select: { id: true, fullName: true } },
        specialty: true,
      },
    });

    if (isApprove && request.coach.coachProfile) {
      const profileId = request.coach.coachProfile.id;
      await this.prisma.coachSpecialty.upsert({
        where: {
          coachProfileId_specialtyId: {
            coachProfileId: profileId,
            specialtyId: request.specialtyId,
          },
        },
        create: {
          coachProfileId: profileId,
          specialtyId: request.specialtyId,
        },
        update: {},
      });
    }

    return updated;
  }
}
