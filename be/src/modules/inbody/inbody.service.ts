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
import { calculateDerivedInbody, analyzeInbody } from './inbody-calc.util';

@Injectable()
export class InbodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}

  progress(memberId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      const rawLogs = await tx.memberInbodyLog.findMany({
        where: { userId: memberId },
        take: 100,
        orderBy: { measuredAt: 'asc' },
      });

      const logs = rawLogs.map((log) => ({
        ...log,
        analysis: analyzeInbody(log),
      }));

      return { logs };
    });
  }

  create(dto: InbodyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const user = await requireRole(tx, dto.userId, UserRole.MEMBER);
      await memberAccess(tx, actor, dto.userId);

      const derived = calculateDerivedInbody({
        ...dto,
        gender: user.gender,
      });

      const value = await tx.memberInbodyLog.create({
        data: {
          ...dto,
          ...derived,
          segmentalLean: derived.segmentalLean as any,
          measuredById: actor.userId,
        },
      });

      await audit(tx, actor, 'CREATE_INBODY', 'member_inbody_logs', value.id);
      return {
        ...value,
        analysis: analyzeInbody(value),
      };
    });
  }

  update(id: string, dto: UpdateInbodyDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const log = requireRecord(
        await tx.memberInbodyLog.findUnique({
          where: { id },
          include: { user: true },
        }),
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

      const mergedInput = {
        heightCm: dto.heightCm ?? Number(log.heightCm),
        weightKg: dto.weightKg ?? Number(log.weightKg),
        bodyFatPct:
          dto.bodyFatPct !== undefined
            ? dto.bodyFatPct
            : log.bodyFatPct != null
              ? Number(log.bodyFatPct)
              : null,
        skeletalMuscleMassKg:
          dto.skeletalMuscleMassKg !== undefined
            ? dto.skeletalMuscleMassKg
            : log.skeletalMuscleMassKg != null
              ? Number(log.skeletalMuscleMassKg)
              : null,
        muscleMassKg:
          dto.muscleMassKg !== undefined
            ? dto.muscleMassKg
            : log.muscleMassKg != null
              ? Number(log.muscleMassKg)
              : null,
        segmentalLean:
          dto.segmentalLean !== undefined
            ? dto.segmentalLean
            : log.segmentalLean,
        gender: log.user?.gender,
      };

      const derived = calculateDerivedInbody(mergedInput);
      const { userId: _ignoreUserId, ...updateData } = dto;

      const value = await tx.memberInbodyLog.update({
        where: { id },
        data: {
          ...updateData,
          ...derived,
          segmentalLean: derived.segmentalLean as any,
        },
      });

      await audit(tx, actor, 'UPDATE_INBODY', 'member_inbody_logs', id);
      return {
        ...value,
        analysis: analyzeInbody(value),
      };
    });
  }
}
