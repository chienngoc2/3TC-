import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireOwner,
  requireRole,
  memberAccess,
  localDate,
  addDays,
} from '../../common/utils/domain';
import {
  GateEntryDto,
  ClassAttendanceDto,
  UpdateAttendanceDto,
  AttendanceHistoryQueryDto,
} from './dto/attendance.dto';
import { parsePagination } from '../../common/dto/pagination.dto';
import { getVietnamDateRange } from '../../common/utils/timezone';
@Injectable()
export class AttendancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
  ) {}
  async gate(dto: GateEntryDto, actor: Actor) {
    const result = await this.transactions.run(async (tx) => {
      await requireRole(tx, dto.memberId, 'MEMBER');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gate:${dto.memberId}`}))`;
      const today = localDate(),
        dayStart = new Date(today.getTime() - 7 * 3600000),
        dayEnd = addDays(dayStart, 1);
      const validSubs = await tx.userSubscription.findMany({
        where: {
          userId: dto.memberId,
          status: 'ACTIVE',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: { discipline: true },
        orderBy: { endDate: 'asc' },
      });
      const unlimited = validSubs.find(
        (sub) =>
          sub.hasUnlimitedGymAccess &&
          sub.discipline?.code.toUpperCase() === 'GYM',
      );
      const quotaAccess = validSubs.some(
        (sub) =>
          (sub.remainingGroupSessions ?? 0) > 0 ||
          (sub.remainingPtSessions ?? 0) > 0,
      );
      const gymDropin = validSubs.find(
        (sub) =>
          sub.discipline?.code.toUpperCase() === 'GYM' &&
          sub.packageTier === 'DROP_IN' &&
          (sub.remainingSessions ?? 0) > 0,
      );
      const dailyBooking = await tx.booking.findFirst({
        where: {
          memberId: dto.memberId,
          status: { in: ['CONFIRMED', 'ATTENDED'] },
          subscription: {
            status: 'ACTIVE',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          OR: [
            {
              schedule: {
                status: { in: ['OPEN', 'FULL', 'COMPLETED'] },
                startTime: { gte: dayStart, lt: dayEnd },
              },
            },
            {
              coachAvailability: {
                isEmergencyCancelled: false,
                startTime: { gte: dayStart, lt: dayEnd },
              },
            },
          ],
        },
      });
      // An unreturned locker represents the same visit, so a repeated scan does not issue amenities twice.
      const current = await tx.lockerAssignment.findFirst({
        where: { userId: dto.memberId, returnedAt: null },
        include: { locker: true },
      });
      const recent = current
        ? await tx.attendance.findFirst({
            where: {
              memberId: dto.memberId,
              checkinType: 'GATE_ENTRY',
              checkInTime: { gte: current.assignedAt },
            },
            orderBy: { checkInTime: 'desc' },
          })
        : null;
      if (current && recent) {
        requireCondition(
          localDate(current.assignedAt).getTime() === today.getTime(),
          'RETURN_OVERNIGHT_LOCKER_FIRST',
        );
        const visitDropin = validSubs.some(
          (sub) =>
            sub.discipline?.code.toUpperCase() === 'GYM' &&
            sub.packageTier === 'DROP_IN',
        );
        requireCondition(
          unlimited || quotaAccess || dailyBooking || visitDropin,
          'GATE_ACCESS_DENIED',
        );
        return {
          attendance: recent,
          lockerAssignment: current,
          repeated: true,
        };
      }
      requireCondition(
        unlimited || quotaAccess || gymDropin || dailyBooking,
        'GATE_ACCESS_DENIED',
      );
      if (!unlimited && !quotaAccess && !dailyBooking && gymDropin) {
        const claimed = await tx.userSubscription.updateMany({
          where: { id: gymDropin.id, remainingSessions: { gt: 0 } },
          data: { remainingSessions: { decrement: 1 } },
        });
        requireCondition(claimed.count === 1, 'GATE_ACCESS_DENIED');
      }
      let lockerAssignment = current;
      if (!lockerAssignment && dto.lockerZone) {
        const available = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM lockers WHERE status = 'AVAILABLE' AND is_active = true AND zone = ${dto.lockerZone} ORDER BY locker_number FOR UPDATE SKIP LOCKED LIMIT 1`;
        requireCondition(available.length, 'NO_AVAILABLE_LOCKER');
        const lockerId = available[0].id;
        await tx.locker.update({
          where: { id: lockerId },
          data: { status: 'OCCUPIED' },
        });
        lockerAssignment = await tx.lockerAssignment.create({
          data: { lockerId, userId: dto.memberId, assignedById: actor.userId },
          include: { locker: true },
        });
      }
      const attendance = await tx.attendance.create({
        data: {
          memberId: dto.memberId,
          verifiedById: actor.userId,
          checkinType: 'GATE_ENTRY',
          towelIssued: dto.towelIssued ?? false,
          notes: dto.notes,
        },
      });
      await audit(tx, actor, 'GATE_CHECK_IN', 'attendances', attendance.id);
      return { attendance, lockerAssignment, repeated: false };
    });
    if (!result.repeated)
      this.events.publish({
        name: 'gate.checked-in',
        data: {
          attendanceId: result.attendance.id,
          memberId: dto.memberId,
          lockerNumber: result.lockerAssignment?.locker.lockerNumber,
        },
        userIds: [dto.memberId],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });
    return result;
  }
  async session(dto: ClassAttendanceDto, actor: Actor, allowUpdate = true) {
    const result = await this.transactions.run(async (tx) => {
      const booking = requireRecord(
        await tx.booking.findUnique({
          where: { id: dto.bookingId },
          include: { schedule: true, coachAvailability: true },
        }),
      );
      const session = requireRecord(
        booking.schedule ?? booking.coachAvailability,
      );
      requireOwner(actor, session.coachId);
      requireCondition(
        booking.status === 'CONFIRMED' || booking.status === 'ATTENDED',
        'BOOKING_NOT_ATTENDABLE',
      );
      requireCondition(session.startTime <= new Date(), 'SESSION_NOT_STARTED');
      const existing = await tx.attendance.findUnique({
        where: { bookingId: booking.id },
      });
      if (existing && !allowUpdate)
        throw new ConflictException('ALREADY_CHECKED_IN');
      requireCondition(
        Date.now() - (existing?.checkInTime ?? session.endTime).getTime() <=
          86400000,
        'ATTENDANCE_EDIT_WINDOW_CLOSED',
      );
      const attendance = await tx.attendance.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          memberId: booking.memberId,
          verifiedById: actor.userId,
          status: dto.status,
          notes: dto.notes,
        },
        update: {
          status: dto.status,
          notes: dto.notes,
          verifiedById: actor.userId,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'ATTENDED' },
      });
      await audit(
        tx,
        actor,
        'MARK_SESSION_ATTENDANCE',
        'attendances',
        attendance.id,
        { status: dto.status },
      );
      return { attendance, booking };
    });
    this.events.publish({
      name: 'attendance.updated',
      data: result.attendance,
      userIds: [result.booking.memberId, actor.userId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    return result.attendance;
  }
  history(memberId: string, actor: Actor, query?: AttendanceHistoryQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      const where = {
        memberId,
        ...(startUtc || endUtc
          ? {
              checkInTime: {
                ...(startUtc ? { gte: startUtc } : {}),
                ...(endUtc ? { lte: endUtc } : {}),
              },
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        tx.attendance.count({ where }),
        tx.attendance.findMany({
          where,
          orderBy: { checkInTime: 'desc' },
          skip,
          take: limit,
        }),
      ]);
      return { items, total, page, limit };
    });
  }
  async correct(id: string, dto: UpdateAttendanceDto, actor: Actor) {
    const existing = requireRecord(
      await this.prisma.attendance.findUnique({ where: { id } }),
    );
    requireCondition(existing.bookingId, 'CLASS_ATTENDANCE_REQUIRED');
    return this.session({ ...dto, bookingId: existing.bookingId }, actor);
  }
}
