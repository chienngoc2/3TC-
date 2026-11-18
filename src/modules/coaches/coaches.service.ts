import { Injectable } from '@nestjs/common';
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
  addDays,
} from '../../common/utils/domain';
import {
  getVietnamDateRange,
  getVietnamDayBounds,
} from '../../common/utils/timezone';
import {
  SlotDto,
  BulkCreateSlotsDto,
  RateDto,
  UpdateRateDto,
} from '../operations/dto/operations.dto';
@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list() {
    return this.prisma.user.findMany({
      where: { role: UserRole.COACH, isActive: true },
      select: {
        id: true,
        fullName: true,
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
        isBooked: false,
        isEmergencyCancelled: false,
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
  ownSlots(actor: Actor, from?: string, to?: string) {
    const { startUtc, endUtc } = getVietnamDateRange(from, to);
    return this.prisma.coachAvailability.findMany({
      where: {
        coachId: actor.userId,
        endTime: { gt: new Date() },
        ...(startUtc || endUtc
          ? {
              startTime: {
                ...(startUtc ? { gte: startUtc } : {}),
                ...(endUtc ? { lte: endUtc } : {}),
              },
            }
          : {}),
      },
      orderBy: { startTime: 'asc' },
      take: startUtc || endUtc ? undefined : 200,
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
  createSlot(dto: SlotDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, actor.userId, UserRole.COACH);
      const startTime = new Date(dto.startTime),
        endTime = new Date(dto.endTime);
      timeRange(startTime, endTime);
      requireCondition(startTime > new Date(), 'SLOT_MUST_BE_FUTURE');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.userId}))`;
      const shift = await tx.staffShift.findFirst({
        where: {
          staffId: actor.userId,
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
      });
      requireCondition(shift, 'SLOT_OUTSIDE_ASSIGNED_SHIFT');
      const slotCount = await tx.coachAvailability.count({
        where: {
          coachId: actor.userId,
          startTime: { gte: shift.startTime, lte: shift.endTime },
          isEmergencyCancelled: false,
        },
      });
      requireCondition(slotCount < 4, 'SHIFT_PT_CAPACITY_REACHED');
      const value = await tx.coachAvailability.create({
        data: { coachId: actor.userId, startTime, endTime },
      });
      await audit(tx, actor, 'CREATE_PT_SLOT', 'coach_availability', value.id);
      return value;
    });
  }
  createSlotsBulk(dto: BulkCreateSlotsDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, actor.userId, UserRole.COACH);
      requireCondition(dto.slots && dto.slots.length > 0, 'NO_SLOTS_TO_CREATE');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.userId}))`;

      const now = new Date();
      const created = [];

      for (const slotDto of dto.slots) {
        const startTime = new Date(slotDto.startTime);
        const endTime = new Date(slotDto.endTime);
        timeRange(startTime, endTime);
        requireCondition(startTime > now, 'SLOT_MUST_BE_FUTURE');

        const shift = await tx.staffShift.findFirst({
          where: {
            staffId: actor.userId,
            startTime: { lte: startTime },
            endTime: { gte: endTime },
          },
        });
        requireCondition(shift, 'SLOT_OUTSIDE_ASSIGNED_SHIFT');

        const slotCount = await tx.coachAvailability.count({
          where: {
            coachId: actor.userId,
            startTime: { gte: shift.startTime, lte: shift.endTime },
            isEmergencyCancelled: false,
          },
        });
        requireCondition(slotCount < 4, 'SHIFT_PT_CAPACITY_REACHED');

        const existing = await tx.coachAvailability.findFirst({
          where: {
            coachId: actor.userId,
            startTime,
            endTime,
            isEmergencyCancelled: false,
          },
        });
        if (!existing) {
          const val = await tx.coachAvailability.create({
            data: { coachId: actor.userId, startTime, endTime },
          });
          created.push(val);
        }
      }

      await audit(
        tx,
        actor,
        'CREATE_SLOTS_BULK',
        'coach_availability',
        actor.userId,
        { count: created.length },
      );
      return { count: created.length, slots: created };
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
      return { id };
    });
  }
  schedule(actor: Actor, dateInput?: string) {
    const { startUtc, endUtc } = getVietnamDayBounds(dateInput || new Date());
    return Promise.all([
      this.prisma.schedule.findMany({
        where: { coachId: actor.userId, startTime: { gte: startUtc, lte: endUtc } },
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
          isBooked: true,
        },
        include: {
          bookings: {
            where: { status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] } },
            include: {
              member: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  avatarUrl: true,
                  memberProfile: true,
                },
              },
              attendance: true,
            },
          },
        },
      }),
    ]).then(([classes, pt]) => ({ classes, pt }));
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
}
