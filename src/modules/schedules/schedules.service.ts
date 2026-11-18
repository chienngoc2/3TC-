import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireRole,
  timeRange,
} from '../../common/utils/domain';
import { ScheduleDto, UpdateScheduleDto } from '../commerce/dto/commerce.dto';
@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list() {
    return this.prisma.schedule.findMany({
      where: { status: { in: ['OPEN', 'FULL'] }, endTime: { gt: new Date() } },
      include: {
        class: { include: { discipline: true } },
        room: true,
        coach: { select: { id: true, fullName: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 200,
    });
  }
  async validate(
    tx: Prisma.TransactionClient,
    dto: ScheduleDto,
    excludeScheduleId?: string,
  ) {
    const start = new Date(dto.startTime),
      end = new Date(dto.endTime);
    timeRange(start, end);
    requireCondition(start > new Date(), 'SCHEDULE_MUST_BE_FUTURE');
    const cls = requireRecord(
      await tx.class.findUnique({
        where: { id: dto.classId },
        include: { discipline: true },
      }),
    );
    const room = requireRecord(
      await tx.room.findUnique({ where: { id: dto.roomId } }),
    );
    requireCondition(room.isActive, 'ROOM_INACTIVE');
    requireCondition(dto.capacity <= room.capacity, 'INVALID_ROOM_CAPACITY');
    const code = cls.discipline.code.toUpperCase();
    requireCondition(code !== 'GYM', 'GYM_GROUP_CLASS_FORBIDDEN');
    await requireRole(tx, dto.coachId, UserRole.COACH);
    requireCondition(
      await tx.coachSpecialty.findFirst({
        where: {
          coachProfile: { userId: dto.coachId },
          specialty: { disciplineId: cls.disciplineId },
        },
      }),
      'COACH_DISCIPLINE_MISMATCH',
    );
    const shift = await tx.staffShift.findFirst({
      where: {
        staffId: dto.coachId,
        startTime: { lte: start },
        endTime: { gte: end },
      },
    });
    requireCondition(shift, 'COACH_NOT_ON_DUTY_SHIFT');
    const dayStart = new Date(start);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const existingClassCount = await tx.schedule.count({
      where: {
        coachId: dto.coachId,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ['OPEN', 'FULL'] },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
    });
    requireCondition(
      existingClassCount < 1,
      'COACH_DAILY_CLASS_LIMIT_EXCEEDED',
    );
  }
  create(dto: ScheduleDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await this.validate(tx, dto);
      const value = await tx.schedule.create({
        data: {
          ...dto,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
        },
      });
      await audit(tx, actor, 'CREATE_SCHEDULE', 'schedules', value.id);
      return value;
    });
  }
  update(id: string, dto: UpdateScheduleDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.schedule.findUnique({ where: { id } }),
      );
      requireCondition(
        ['OPEN', 'FULL'].includes(old.status) && old.startTime > new Date(),
        'SCHEDULE_NOT_EDITABLE',
      );
      requireCondition(
        !(await tx.booking.count({
          where: {
            scheduleId: id,
            status: { in: ['CONFIRMED', 'PENDING', 'ATTENDED'] },
          },
        })),
        'SCHEDULE_HAS_BOOKINGS',
      );
      const merged = {
        ...old,
        startTime: old.startTime.toISOString(),
        endTime: old.endTime.toISOString(),
        ...dto,
      };
      await this.validate(tx, merged, id);
      const value = await tx.schedule.update({
        where: { id },
        data: {
          ...dto,
          startTime: new Date(merged.startTime),
          endTime: new Date(merged.endTime),
        },
      });
      await audit(tx, actor, 'UPDATE_SCHEDULE', 'schedules', id, dto);
      return value;
    });
  }
  delete(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.schedule.findUnique({ where: { id } }));
      requireCondition(
        !(await tx.booking.count({ where: { scheduleId: id } })),
        'SCHEDULE_HAS_HISTORY',
      );
      requireCondition(
        !(await tx.cancellationRequest.count({ where: { scheduleId: id } })),
        'SCHEDULE_HAS_HISTORY',
      );
      await tx.schedule.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_SCHEDULE', 'schedules', id);
      return { id };
    });
  }
}
