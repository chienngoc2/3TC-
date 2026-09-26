import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import {
  requireRecord,
  requireCondition,
  requireRole,
  audit,
  localDate,
  addDays,
} from '../../common/utils/domain';
import { PurchaseDto, RenewDto, AddonDto } from '../commerce/dto/commerce.dto';
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}
  async rate(
    tx: Prisma.TransactionClient,
    coachId: string,
    disciplineId: string | null,
  ) {
    await requireRole(tx, coachId, UserRole.COACH);
    const expertise = await tx.coachSpecialty.findFirst({
      where: {
        coachProfile: { userId: coachId },
        specialty: { disciplineId: disciplineId ?? undefined },
      },
    });
    requireCondition(expertise, 'COACH_DISCIPLINE_MISMATCH');
    const today = localDate();
    return requireRecord(
      await tx.coachRate.findFirst({
        where: {
          coachId,
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      'COACH_RATE_NOT_CONFIGURED',
    ).ratePerSession;
  }
  purchase(dto: PurchaseDto, actor: Actor) {
    return this.transactions.run((tx) => this.sell(tx, dto, actor));
  }
  vip(dto: PurchaseDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const plan = requireRecord(
        await tx.membershipPlan.findUnique({ where: { id: dto.planId } }),
      );
      requireCondition(plan.packageTier === 'VIP', 'VIP_PLAN_REQUIRED');
      const sold = await this.sell(tx, dto, actor);
      return {
        ...sold,
        subscriptionId: sold.subscription.id,
        invoiceId: sold.invoice.id,
        baseAmount: sold.invoice.baseAmount,
        ptAmount: sold.invoice.ptAmount,
        totalAmount: sold.invoice.amount,
        invoiceCode: sold.invoice.invoiceCode,
      };
    });
  }
  private async sell(
    tx: Prisma.TransactionClient,
    dto: PurchaseDto,
    actor: Actor,
    startDate = localDate(),
  ) {
    await requireRole(tx, dto.memberId, UserRole.MEMBER);
    const plan = requireRecord(
      await tx.membershipPlan.findUnique({
        where: { id: dto.planId },
        include: { discipline: true },
      }),
      'PLAN_NOT_FOUND',
    );
    requireCondition(plan.isActive, 'PLAN_DISABLED');
    const ptQuota =
      plan.packageTier === 'VIP' ? 12 : (plan.ptSessionQuota ?? 0);
    requireCondition(!ptQuota || dto.coachId, 'COACH_REQUIRED');
    requireCondition(ptQuota > 0 || !dto.coachId, 'COACH_NOT_APPLICABLE');
    if (plan.packageTier === 'TRIAL')
      requireCondition(
        !(await tx.userSubscription.findFirst({
          where: {
            userId: dto.memberId,
            disciplineId: plan.disciplineId,
            packageTier: 'TRIAL',
          },
        })),
        'TRIAL_ALREADY_USED',
      );
    const rate = dto.coachId
      ? await this.rate(tx, dto.coachId, plan.disciplineId)
      : new Prisma.Decimal(0);
    const ptAmount = rate.mul(ptQuota),
      baseAmount = plan.price;
    const subscription = await tx.userSubscription.create({
      data: {
        userId: dto.memberId,
        planId: plan.id,
        disciplineId: plan.disciplineId,
        packageTier: plan.packageTier,
        assignedCoachId: dto.coachId,
        startDate,
        endDate: addDays(startDate, plan.durationDays - 1),
        remainingSessions:
          plan.discipline?.code.toUpperCase() === 'GYM' &&
          plan.packageTier === 'DROP_IN'
            ? 1
            : (plan.groupSessionQuota ?? 0) + ptQuota,
        remainingGroupSessions: plan.groupSessionQuota ?? 0,
        remainingPtSessions: ptQuota,
        hasUnlimitedGymAccess: plan.unlimitedGymEntry,
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        invoiceCode: `INV-${randomUUID()}`,
        subscriptionId: subscription.id,
        issuerId: actor.userId,
        amount: baseAmount.add(ptAmount),
        baseAmount,
        ptAmount,
        paymentMethod: dto.paymentMethod,
        transactionRef: dto.transactionRef,
        type: plan.packageTier === 'DROP_IN' ? 'DROP_IN' : 'SUBSCRIPTION_NEW',
      },
    });
    await audit(
      tx,
      actor,
      'PURCHASE_SUBSCRIPTION',
      'user_subscriptions',
      subscription.id,
      { invoiceId: invoice.id, amount: invoice.amount },
    );
    return { subscription, invoice };
  }
  renew(id: string, dto: RenewDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id } }),
      );
      requireCondition(
        sub.packageTier !== 'TRIAL' && sub.packageTier !== 'DROP_IN',
        'SUBSCRIPTION_NOT_RENEWABLE',
      );
      requireCondition(sub.status !== 'FROZEN', 'UNFREEZE_BEFORE_RENEWAL');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sub.userId + ':' + sub.planId}))`;
      const last = await tx.userSubscription.findFirst({
        where: {
          userId: sub.userId,
          planId: sub.planId,
          status: { not: 'FROZEN' },
        },
        orderBy: { endDate: 'desc' },
      });
      const today = localDate(),
        start =
          last && last.endDate >= today ? addDays(last.endDate, 1) : today;
      return this.sell(
        tx,
        {
          ...dto,
          memberId: sub.userId,
          planId: sub.planId,
          coachId: sub.assignedCoachId ?? undefined,
        },
        actor,
        start,
      );
    });
  }
  addon(id: string, dto: AddonDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id } }),
      );
      const today = localDate();
      requireCondition(
        sub.status === 'ACTIVE' &&
          sub.startDate <= today &&
          sub.endDate >= today &&
          sub.assignedCoachId,
        'INVALID_PT_SUBSCRIPTION',
      );
      const rate = await this.rate(tx, sub.assignedCoachId, sub.disciplineId),
        amount = rate.mul(dto.sessions);
      const subscription = await tx.userSubscription.update({
        where: { id },
        data: {
          remainingPtSessions: { increment: dto.sessions },
          remainingSessions: { increment: dto.sessions },
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          invoiceCode: `INV-${randomUUID()}`,
          subscriptionId: id,
          issuerId: actor.userId,
          amount,
          baseAmount: 0,
          ptAmount: amount,
          type: 'PT_ADDON',
          paymentMethod: dto.paymentMethod,
          transactionRef: dto.transactionRef,
        },
      });
      await audit(tx, actor, 'PURCHASE_PT_ADDON', 'user_subscriptions', id, {
        sessions: dto.sessions,
        invoiceId: invoice.id,
      });
      return { subscription, invoice };
    });
  }
  invoices(actor: Actor) {
    return this.prisma.invoice.findMany({
      where:
        actor.role === 'MEMBER'
          ? { subscription: { userId: actor.userId } }
          : {},
      include: { subscription: { select: { userId: true, planId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
