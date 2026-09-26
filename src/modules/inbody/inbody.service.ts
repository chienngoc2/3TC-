import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  memberAccess,
  requireCondition,
  requireRecord,
  requireRole,
} from '../../common/utils/domain';
import { InbodyDto, UpdateInbodyDto } from '../operations/dto/operations.dto';
@Injectable()
export class InbodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  progress(memberId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      return {
        logs: await tx.memberInbodyLog.findMany({
          where: { userId: memberId },
          take: 100,
          orderBy: { measuredAt: 'asc' },
        }),
      };
    });
  }
  create(dto: InbodyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await requireRole(tx, dto.userId, UserRole.MEMBER);
      await memberAccess(tx, actor, dto.userId);
      const value = await tx.memberInbodyLog.create({
        data: { ...dto, measuredById: actor.userId },
      });
      await audit(tx, actor, 'CREATE_INBODY', 'member_inbody_logs', value.id);
      return value;
    });
  }
  update(id: string, dto: UpdateInbodyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const log = requireRecord(
        await tx.memberInbodyLog.findUnique({ where: { id } }),
      );
      if (
        log.measuredById !== actor.userId &&
        actor.role !== UserRole.CENTER_MANAGER
      )
        throw new ForbiddenException('FORBIDDEN_RESOURCE');
      requireCondition(
        new Date().getTime() - log.measuredAt.getTime() <= 86400000,
        'INBODY_EDIT_WINDOW_EXPIRED',
      );
      requireCondition(
        !dto.userId || dto.userId === log.userId,
        'CANNOT_CHANGE_INBODY_OWNER',
      );
      const value = await tx.memberInbodyLog.update({
        where: { id },
        data: dto,
      });
      await audit(tx, actor, 'UPDATE_INBODY', 'member_inbody_logs', id);
      return value;
    });
  }
}
