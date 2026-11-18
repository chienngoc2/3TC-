import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireAnyRole,
  timeRange,
} from '../../common/utils/domain';
import {
  getVietnamDateRange,
  getVietnamDayBounds,
} from '../../common/utils/timezone';
import {
  ShiftDto,
  ShiftQueryDto,
  BulkCreateShiftsDto,
  UpdateShiftDto,
  CloneWeeklyShiftsDto,
} from '../operations/dto/operations.dto';
@Injectable()
export class StaffShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(query?: ShiftQueryDto | string) {
    const staffId = typeof query === 'string' ? query : query?.staffId;
    const from = typeof query === 'object' ? query?.from : undefined;
    const to = typeof query === 'object' ? query?.to : undefined;

    const { startUtc, endUtc } = getVietnamDateRange(from, to);

    return this.prisma.staffShift.findMany({
      where: {
        ...(staffId ? { staffId } : {}),
        ...(startUtc || endUtc
          ? {
              startTime: {
                ...(startUtc ? { gte: startUtc } : {}),
                ...(endUtc ? { lte: endUtc } : {}),
              },
            }
          : {}),
      },
      take: startUtc || endUtc ? undefined : 200,
      orderBy: { startTime: 'asc' },
    });
  }
  create(dto: ShiftDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireAnyRole(tx, dto.staffId, [
        UserRole.RECEPTIONIST,
        UserRole.COACH,
      ]);
      const startTime = new Date(dto.startTime),
        endTime = new Date(dto.endTime);
      timeRange(startTime, endTime);
      const value = await tx.staffShift.create({
        data: {
          ...dto,
          startTime,
          endTime,
          shiftDate: new Date(dto.shiftDate),
          assignedById: actor.userId,
        },
      });
      await audit(tx, actor, 'CREATE_SHIFT', 'staff_shifts', value.id);
      return value;
    });
  }
  createBulk(dto: BulkCreateShiftsDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireCondition(
        dto.shifts && dto.shifts.length > 0,
        'NO_SHIFTS_TO_CREATE',
      );
      const created = [];
      for (const shiftDto of dto.shifts) {
        await requireAnyRole(tx, shiftDto.staffId, [
          UserRole.RECEPTIONIST,
          UserRole.COACH,
        ]);
        const startTime = new Date(shiftDto.startTime),
          endTime = new Date(shiftDto.endTime);
        timeRange(startTime, endTime);

        const existing = await tx.staffShift.findFirst({
          where: {
            staffId: shiftDto.staffId,
            startTime,
            endTime,
          },
        });
        if (!existing) {
          const value = await tx.staffShift.create({
            data: {
              ...shiftDto,
              startTime,
              endTime,
              shiftDate: new Date(shiftDto.shiftDate),
              assignedById: actor.userId,
            },
          });
          created.push(value);
        }
      }
      await audit(
        tx,
        actor,
        'CREATE_SHIFTS_BULK',
        'staff_shifts',
        actor.userId,
        { count: created.length },
      );
      return { count: created.length, shifts: created };
    });
  }
  update(id: string, dto: UpdateShiftDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const shift = requireRecord(
        await tx.staffShift.findUnique({ where: { id } }),
      );
      if (dto.staffId)
        await requireAnyRole(tx, dto.staffId, [
          UserRole.RECEPTIONIST,
          UserRole.COACH,
        ]);
      const startTime = dto.startTime
          ? new Date(dto.startTime)
          : shift.startTime,
        endTime = dto.endTime ? new Date(dto.endTime) : shift.endTime;
      timeRange(startTime, endTime);
      const value = await tx.staffShift.update({
        where: { id },
        data: {
          ...dto,
          startTime,
          endTime,
          shiftDate: dto.shiftDate ? new Date(dto.shiftDate) : undefined,
        },
      });
      await audit(tx, actor, 'UPDATE_SHIFT', 'staff_shifts', id);
      return value;
    });
  }
  delete(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const shift = requireRecord(
        await tx.staffShift.findUnique({ where: { id } }),
      );
      const [hasSchedule, hasBookedSlot] = await Promise.all([
        tx.schedule.count({
          where: {
            coachId: shift.staffId,
            startTime: { gte: shift.startTime },
            endTime: { lte: shift.endTime },
            status: { in: ['OPEN', 'FULL'] },
          },
        }),
        tx.coachAvailability.count({
          where: {
            coachId: shift.staffId,
            startTime: { gte: shift.startTime },
            endTime: { lte: shift.endTime },
            isBooked: true,
            isEmergencyCancelled: false,
          },
        }),
      ]);
      requireCondition(
        !hasSchedule && !hasBookedSlot,
        'SHIFT_CONTAINS_ACTIVE_ASSIGNMENTS',
      );
      await tx.staffShift.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_SHIFT', 'staff_shifts', id);
      return { id };
    });
  }
  cloneWeekly(dto: CloneWeeklyShiftsDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sourceBounds = getVietnamDayBounds(dto.sourceWeekStart);
      const targetBounds = getVietnamDayBounds(dto.targetWeekStart);
      const sourceStart = sourceBounds.startUtc;
      const sourceEnd = new Date(sourceStart.getTime() + 7 * 86400000);
      const targetStart = targetBounds.startUtc;
      const dayOffsetMs = targetStart.getTime() - sourceStart.getTime();

      const sourceShifts = await tx.staffShift.findMany({
        where: {
          startTime: { gte: sourceStart, lt: sourceEnd },
        },
      });

      requireCondition(sourceShifts.length > 0, 'NO_SHIFTS_TO_CLONE');

      const created = [];
      for (const shift of sourceShifts) {
        const newStartTime = new Date(shift.startTime.getTime() + dayOffsetMs);
        const newEndTime = new Date(shift.endTime.getTime() + dayOffsetMs);
        const newShiftDate = new Date(shift.shiftDate.getTime() + dayOffsetMs);

        const existing = await tx.staffShift.findFirst({
          where: {
            staffId: shift.staffId,
            startTime: newStartTime,
            endTime: newEndTime,
          },
        });
        if (!existing) {
          const val = await tx.staffShift.create({
            data: {
              staffId: shift.staffId,
              startTime: newStartTime,
              endTime: newEndTime,
              shiftDate: newShiftDate,
              notes: shift.notes,
              assignedById: actor.userId,
            },
          });
          created.push(val);
        }
      }
      await audit(
        tx,
        actor,
        'CLONE_WEEKLY_SHIFTS',
        'staff_shifts',
        actor.userId,
        {
          clonedCount: created.length,
          sourceWeekStart: dto.sourceWeekStart,
          targetWeekStart: dto.targetWeekStart,
        },
      );
      return { clonedCount: created.length, shifts: created };
    });
  }
}
