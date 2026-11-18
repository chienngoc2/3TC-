import { Injectable } from '@nestjs/common';
import { LockerStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireOwner,
} from '../../common/utils/domain';
import { LockerDto } from '../operations/dto/operations.dto';
@Injectable()
export class LockersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  async list(zone?: string, status?: LockerStatus) {
    const lockers = await this.prisma.locker.findMany({
      where: {
        ...(zone ? { zone } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        assignments: {
          where: { returnedAt: null },
          take: 1,
          orderBy: { assignedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { lockerNumber: 'asc' },
    });

    return lockers.map((locker) => {
      const active = locker.assignments[0] ?? null;
      return {
        id: locker.id,
        lockerNumber: locker.lockerNumber,
        zone: locker.zone,
        status: locker.status,
        isActive: locker.isActive,
        currentAssignment: active
          ? {
              id: active.id,
              userId: active.userId,
              assignedAt: active.assignedAt,
              notes: active.notes,
              user: active.user,
            }
          : null,
      };
    });
  }
  mine(actor: Actor) {
    return this.prisma.lockerAssignment.findMany({
      where: { userId: actor.userId, returnedAt: null },
      include: { locker: true },
    });
  }
  create(dto: LockerDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const value = await tx.locker.create({ data: dto });
      await audit(tx, actor, 'CREATE_LOCKER', 'lockers', value.id);
      return value;
    });
  }
  status(id: string, status: LockerStatus, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.locker.findUnique({ where: { id } }));
      const active = await tx.lockerAssignment.count({
        where: { lockerId: id, returnedAt: null },
      });
      requireCondition(
        active
          ? status === LockerStatus.OCCUPIED
          : status !== LockerStatus.OCCUPIED,
        'LOCKER_ASSIGNMENT_STATUS_MISMATCH',
      );
      const value = await tx.locker.update({ where: { id }, data: { status } });
      await audit(tx, actor, 'UPDATE_LOCKER_STATUS', 'lockers', id);
      return value;
    });
  }
  return(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const assignment = requireRecord(
        await tx.lockerAssignment.findUnique({ where: { id } }),
      );
      if (actor.role === UserRole.MEMBER)
        requireOwner(actor, assignment.userId);
      requireCondition(!assignment.returnedAt, 'LOCKER_ALREADY_RETURNED');
      const returnedAt = new Date();
      const claim = await tx.lockerAssignment.updateMany({
        where: { id, returnedAt: null },
        data: { returnedAt },
      });
      requireCondition(claim.count === 1, 'LOCKER_ALREADY_RETURNED');
      await tx.locker.update({
        where: { id: assignment.lockerId },
        data: { status: LockerStatus.AVAILABLE },
      });
      await audit(tx, actor, 'RETURN_LOCKER', 'locker_assignments', id);
      return { id, returnedAt };
    });
  }
  release(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const locker = requireRecord(
        await tx.locker.findUnique({ where: { id } }),
        'LOCKER_NOT_FOUND',
      );
      const activeAssignment = await tx.lockerAssignment.findFirst({
        where: { lockerId: id, returnedAt: null },
        orderBy: { assignedAt: 'desc' },
      });
      requireCondition(
        locker.status === LockerStatus.OCCUPIED || Boolean(activeAssignment),
        'LOCKER_NOT_OCCUPIED',
      );
      const returnedAt = new Date();
      if (activeAssignment) {
        await tx.lockerAssignment.update({
          where: { id: activeAssignment.id },
          data: { returnedAt },
        });
      }
      const updated = await tx.locker.update({
        where: { id },
        data: { status: LockerStatus.AVAILABLE },
      });
      await audit(tx, actor, 'RELEASE_LOCKER', 'lockers', id, {
        lockerNumber: updated.lockerNumber,
        releasedAssignmentId: activeAssignment?.id ?? null,
        memberId: activeAssignment?.userId ?? null,
      });
      return {
        id: updated.id,
        lockerNumber: updated.lockerNumber,
        status: updated.status,
        releasedAssignmentId: activeAssignment?.id ?? null,
        returnedAt,
      };
    });
  }
}
