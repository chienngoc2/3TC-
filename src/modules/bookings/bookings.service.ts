import { ConflictException, Injectable } from '@nestjs/common';
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
import {
  GroupBookingDto,
  PtBookingDto,
  CancelDto,
} from '../commerce/dto/commerce.dto';
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
  ) {}
  private async member(
    tx: Prisma.TransactionClient,
    actor: Actor,
    memberId?: string,
  ) {
    const id = memberId ?? actor.userId;
    await memberAccess(tx, actor, id);
    await requireRole(tx, id, UserRole.MEMBER);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`member:${id}`}))`;
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
          endDate: { gte: sessionDate > today ? sessionDate : today },
          ...(pt
            ? { assignedCoachId: coachId, remainingPtSessions: { gt: 0 } }
            : { remainingGroupSessions: { gt: 0 } }),
        },
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
  async group(dto: GroupBookingDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      const memberId = await this.member(tx, actor, dto.memberId);
      await tx.$queryRaw`SELECT id FROM schedules WHERE id = ${dto.scheduleId}::uuid FOR UPDATE`;
      const schedule = requireRecord(
        await tx.schedule.findUnique({
          where: { id: dto.scheduleId },
          include: { class: true, coach: true, room: true },
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
      const sub = await this.quota(
        tx,
        memberId,
        schedule.class.disciplineId,
        schedule.startTime,
        false,
      );
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.coachId}))`;
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
          cancelledBy: true,
          isEmergencyCancellation: true,
        },
      });
      if (sameDay.some((booking) => booking.status !== 'CANCELLED'))
        throw new ConflictException('PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY');
      if (
        sameDay.some(
          (booking) =>
            booking.status === 'CANCELLED' &&
            booking.cancelledBy === 'MEMBER' &&
            !booking.isEmergencyCancellation,
        )
      )
        throw new ConflictException('PT_REBOOK_SAME_CANCELLED_DAY');
      const claim = await tx.coachAvailability.updateMany({
        where: { id: initial.id, isBooked: false, isEmergencyCancelled: false },
        data: { isBooked: true },
      });
      requireCondition(claim.count === 1, 'PT_SLOT_UNAVAILABLE');
      await this.noOverlap(tx, memberId, initial.startTime, initial.endTime);
      const sub = await this.quota(
        tx,
        memberId,
        dto.disciplineId,
        initial.startTime,
        true,
        initial.coachId,
      );
      const booking = await tx.booking.create({
        data: {
          subscriptionId: sub.id,
          coachAvailabilityId: initial.id,
          memberId,
          disciplineId: dto.disciplineId,
          bookingType: 'PERSONAL_TRAINING',
        },
      });
      await this.reserve(
        tx,
        dto.equipmentId,
        booking.id,
        initial.startTime,
        initial.endTime,
      );
      await audit(tx, actor, 'BOOK_PT', 'bookings', booking.id);
      return {
        booking,
        coachId: initial.coachId,
        remainingPtSessions: (sub.remainingPtSessions ?? 0) - 1,
      };
    });
    this.changed(result.booking, result.coachId);
    return {
      ...result.booking,
      bookingId: result.booking.id,
      remainingPtSessions: result.remainingPtSessions,
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
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
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
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });
  }
  list(actor: Actor) {
    return this.prisma.booking.findMany({
      where:
        actor.role === 'MEMBER'
          ? { memberId: actor.userId }
          : actor.role === 'COACH'
            ? {
                OR: [
                  { schedule: { coachId: actor.userId } },
                  { coachAvailability: { coachId: actor.userId } },
                ],
              }
            : {},
      include: {
        schedule: { include: { class: true } },
        coachAvailability: true,
        attendance: true,
      },
      orderBy: { bookedAt: 'desc' },
      take: 200,
    });
  }
  async cancel(id: string, dto: CancelDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      const booking = requireRecord(
        await tx.booking.findUnique({
          where: { id },
          include: { schedule: true, coachAvailability: true },
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
      return { booking, coachId: session.coachId, refunded: !late, schedule };
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
    if (booking.coachAvailabilityId)
      await tx.coachAvailability.update({
        where: { id: booking.coachAvailabilityId },
        data: { isBooked: false },
      });
    await tx.equipmentReservation.deleteMany({
      where: { bookingId: booking.id },
    });
  }
}
