import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireRole,
  timeRange,
} from '../../common/utils/domain';
import { ShiftDto, UpdateShiftDto } from '../operations/dto/operations.dto';
@Injectable()
export class StaffShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(staffId?: string) {
    return this.prisma.staffShift.findMany({
      where: { staffId },
      take: 200,
      orderBy: { startTime: 'desc' },
    });
  }
  create(dto: ShiftDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, dto.staffId, UserRole.RECEPTIONIST);
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
  update(id: string, dto: UpdateShiftDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const shift = requireRecord(
        await tx.staffShift.findUnique({ where: { id } }),
      );
      if (dto.staffId)
        await requireRole(tx, dto.staffId, UserRole.RECEPTIONIST);
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
      requireRecord(await tx.staffShift.findUnique({ where: { id } }));
      await tx.staffShift.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_SHIFT', 'staff_shifts', id);
      return { id };
    });
  }
}
