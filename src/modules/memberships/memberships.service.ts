import { Injectable } from '@nestjs/common';
import { PackageTier } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  requireRecord,
  requireCondition,
  audit,
  localDate,
  addDays,
  memberAccess,
} from '../../common/utils/domain';
import {
  PlanDto,
  UpdatePlanDto,
  SubscriptionStatusDto,
} from '../commerce/dto/commerce.dto';
@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  list(disciplineId?: string, packageTier?: PackageTier) {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true, disciplineId, packageTier },
      include: { discipline: true, curriculumRequirements: true },
      orderBy: { price: 'asc' },
    });
  }
  async validate(
    tx: import('@prisma/client').Prisma.TransactionClient,
    dto: PlanDto,
  ) {
    const discipline = requireRecord(
      await tx.discipline.findUnique({ where: { id: dto.disciplineId } }),
    );
    requireCondition(
      discipline.code.toUpperCase() !== 'GYM' ||
        (dto.trainingMode !== 'GROUP_CLASS' && dto.groupSessionQuota === 0),
      'GYM_GROUP_PLAN_FORBIDDEN',
    );
    requireCondition(
      !dto.unlimitedGymEntry || discipline.code.toUpperCase() === 'GYM',
      'UNLIMITED_ACCESS_GYM_ONLY',
    );
    requireCondition(
      dto.packageTier !== 'VIP' || dto.ptSessionQuota === 12,
      'VIP_REQUIRES_12_PT_SESSIONS',
    );
    requireCondition(
      dto.packageTier !== 'TRIAL' ||
        (dto.price === 0 && dto.ptSessionQuota === 0),
      'INVALID_TRIAL_PLAN',
    );
  }
  create(dto: PlanDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await this.validate(tx, dto);
      const value = await tx.membershipPlan.create({
        data: {
          ...dto,
          sessionQuota: dto.groupSessionQuota + dto.ptSessionQuota,
        },
      });
      await audit(tx, actor, 'CREATE_PLAN', 'membership_plans', value.id);
      return value;
    });
  }
  update(id: string, dto: UpdatePlanDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const old = requireRecord(
        await tx.membershipPlan.findUnique({ where: { id } }),
      );
      // Existing contracts retain their entitlements; their identifying discipline/tier cannot change.
      requireCondition(
        !dto.disciplineId || dto.disciplineId === old.disciplineId,
        'PLAN_DISCIPLINE_IMMUTABLE',
      );
      requireCondition(
        !dto.packageTier || dto.packageTier === old.packageTier,
        'PLAN_TIER_IMMUTABLE',
      );
      const data = {
        ...old,
        price: Number(old.price),
        groupSessionQuota: old.groupSessionQuota ?? 0,
        ptSessionQuota: old.ptSessionQuota ?? 0,
        unlimitedGymEntry: old.unlimitedGymEntry ?? false,
        ...dto,
      } as PlanDto;
      await this.validate(tx, data);
      const value = await tx.membershipPlan.update({
        where: { id },
        data: {
          ...dto,
          sessionQuota: data.groupSessionQuota + data.ptSessionQuota,
        },
      });
      await audit(tx, actor, 'UPDATE_PLAN', 'membership_plans', id, dto);
      return value;
    });
  }
  disable(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.membershipPlan.findUnique({ where: { id } }));
      const value = await tx.membershipPlan.update({
        where: { id },
        data: { isActive: false },
      });
      await audit(tx, actor, 'DISABLE_PLAN', 'membership_plans', id);
      return value;
    });
  }
  subscriptions(memberId: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      await memberAccess(tx, actor, memberId);
      return tx.userSubscription.findMany({
        where: { userId: memberId },
        include: {
          plan: true,
          assignedCoach: { select: { id: true, fullName: true } },
        },
        orderBy: { endDate: 'asc' },
      });
    });
  }
  status(id: string, dto: SubscriptionStatusDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id } }),
      );
      requireCondition(
        dto.status === 'FROZEN' || dto.status === 'ACTIVE',
        'INVALID_MANUAL_STATUS',
      );
      const today = localDate();
      let endDate = sub.endDate;
      if (dto.status === 'FROZEN')
        requireCondition(
          sub.status === 'ACTIVE' &&
            sub.startDate <= today &&
            sub.endDate >= today,
          'SUBSCRIPTION_NOT_FREEZABLE',
        );
      else {
        requireCondition(
          sub.status === 'FROZEN' && sub.frozenAt,
          'SUBSCRIPTION_NOT_FROZEN',
        );
        endDate = addDays(
          endDate,
          Math.max(
            0,
            Math.floor(
              (today.getTime() - localDate(sub.frozenAt).getTime()) / 86400000,
            ),
          ),
        );
      }
      const value = await tx.userSubscription.update({
        where: { id },
        data: {
          status: dto.status,
          frozenAt: dto.status === 'FROZEN' ? new Date() : null,
          endDate,
        },
      });
      await audit(
        tx,
        actor,
        'CHANGE_SUBSCRIPTION_STATUS',
        'user_subscriptions',
        id,
        dto,
      );
      return value;
    });
  }
}
