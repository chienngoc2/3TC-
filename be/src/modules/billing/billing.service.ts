import { Injectable, ConflictException } from '@nestjs/common';
import { CheckoutOrder, Prisma, UserRole } from '@prisma/client';
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
import { InvoiceListQueryDto } from './checkout.dto';
import { parsePagination } from '../../common/dto/pagination.dto';
import { getVietnamDateRange } from '../../common/utils/timezone';
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
    requireCondition(disciplineId, 'PLAN_DISCIPLINE_REQUIRED');
    let expertise = await tx.coachSpecialty.findFirst({
      where: {
        coachProfile: { userId: coachId },
        specialty: { disciplineId },
      },
    });
    if (!expertise) {
      expertise = (await tx.coachRate.findFirst({
        where: {
          coachId,
          disciplineId,
        },
      })) as any;
    }
    if (!expertise) {
      const disc = await tx.discipline.findUnique({ where: { id: disciplineId } });
      if (disc) {
        const profile = await tx.coachProfile.findUnique({ where: { userId: coachId } });
        if (profile?.specialties && disc.code && profile.specialties.toUpperCase().includes(disc.code.toUpperCase())) {
          expertise = profile as any;
        }
      }
    }
    requireCondition(expertise, 'COACH_DISCIPLINE_MISMATCH');

    // 1 sao = 1.000 đ/buổi; Check coach profile rating stars / ratePerSession first
    const profile = await tx.coachProfile.findUnique({
      where: { userId: coachId },
    });
    if (profile) {
      if (profile.ratePerSession && Number(profile.ratePerSession) > 0) {
        return profile.ratePerSession;
      }
      if (profile.ratingStars) {
        return new Prisma.Decimal(profile.ratingStars * 1000);
      }
    }

    const today = localDate();
    const activeRate = {
      coachId,
      effectiveFrom: { lte: today },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
    };
    const scoped = await tx.coachRate.findFirst({
      where: { ...activeRate, disciplineId },
      orderBy: { effectiveFrom: 'desc' },
    });
    const legacy = scoped
      ? null
      : await tx.coachRate.findFirst({
          where: { ...activeRate, disciplineId: null },
          orderBy: { effectiveFrom: 'desc' },
        });
    const found = scoped ?? legacy;
    if (found) return found.ratePerSession;
    return new Prisma.Decimal(300000);
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
  async vipQuote(planId: string, coachId: string) {
    const plan = requireRecord(
      await this.prisma.membershipPlan.findUnique({ where: { id: planId } }),
      'PLAN_NOT_FOUND',
    );
    requireCondition(
      plan.isActive && plan.packageTier === 'VIP',
      'VIP_PLAN_REQUIRED',
    );
    const rate = await this.rate(this.prisma, coachId, plan.disciplineId);
    const ptSessions = plan.ptSessionQuota ?? 0;
    const ptAmount = rate.mul(ptSessions);
    return {
      planId,
      coachId,
      disciplineId: plan.disciplineId,
      baseAmount: plan.price,
      ptSessions,
      ratePerSession: rate,
      ptAmount,
      totalAmount: plan.price.add(ptAmount),
      currency: 'VND',
      calculatedAt: new Date().toISOString(),
      eligible: true,
    };
  }
  async addonPreview(id: string, sessions: number, actor: Actor) {
    const sub = requireRecord(
      await this.prisma.userSubscription.findUnique({ where: { id } }),
      'SUBSCRIPTION_NOT_FOUND',
    );
    requireCondition(sub.userId === actor.userId, 'FORBIDDEN_RESOURCE');
    const today = localDate();
    requireCondition(
      sub.status === 'ACTIVE' &&
        sub.startDate <= today &&
        sub.endDate >= today &&
        sub.assignedCoachId,
      'INVALID_PT_SUBSCRIPTION',
    );
    const rate = await this.rate(
      this.prisma,
      sub.assignedCoachId,
      sub.disciplineId,
    );
    return {
      subscriptionId: id,
      sessions,
      ratePerSession: rate,
      amount: rate.mul(sessions),
      currency: 'VND',
      calculatedAt: new Date().toISOString(),
    };
  }
  private async sell(
    tx: Prisma.TransactionClient,
    dto: PurchaseDto,
    actor: Actor,
    startDate = localDate(),
    snapshot?: {
      baseAmount: Prisma.Decimal;
      ptAmount: Prisma.Decimal;
      ptQuota: number;
      groupQuota: number;
      durationDays: number;
      unlimitedGymEntry: boolean;
    },
    checkoutId?: string,
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
      snapshot?.ptQuota !== undefined
        ? snapshot.ptQuota
        : (plan.packageTier === 'VIP' ? 12 : (plan.ptSessionQuota ?? 0));
    const groupQuota = snapshot?.groupQuota !== undefined ? snapshot.groupQuota : (plan.groupSessionQuota ?? 0);
    requireCondition(!ptQuota || Boolean(dto.coachId), 'COACH_REQUIRED');
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
    const rate =
      !snapshot && dto.coachId
        ? await this.rate(tx, dto.coachId, plan.disciplineId)
        : new Prisma.Decimal(0);
    const ptAmount = snapshot?.ptAmount ?? rate.mul(ptQuota),
      baseAmount = snapshot?.baseAmount ?? plan.price;

    let coachRatingStars = (snapshot as any)?.coachRatingStars ?? (dto as any).coachRatingStars ?? (plan as any).coachRatingStars ?? 3;
    let coachName: string | null = null;
    if (dto.coachId) {
      const coach = await tx.user.findUnique({
        where: { id: dto.coachId },
        include: { coachProfile: true },
      });
      if (coach) {
        coachName = coach.fullName;
        if (coach.coachProfile?.ratingStars) {
          coachRatingStars = coach.coachProfile.ratingStars;
        }
      }
    }

    const givesGymAccess =
      plan.discipline?.code?.toUpperCase() === 'GYM' ||
      Boolean(snapshot?.unlimitedGymEntry ?? plan.unlimitedGymEntry) ||
      plan.packageTier === 'VIP';

    // Check existing active subscription with coach (PT/VIP)
    if (dto.coachId) {
      const activeSub = await tx.userSubscription.findFirst({
        where: {
          userId: dto.memberId,
          disciplineId: plan.disciplineId,
          status: 'ACTIVE',
          endDate: { gte: localDate() },
          assignedCoachId: { not: null },
          coachRatingStars,
        },
        orderBy: { endDate: 'desc' },
      });

      if (activeSub) {
        if (activeSub.assignedCoachId !== dto.coachId) {
          throw new ConflictException(
            'Bạn đang có gói tập này với HLV khác. Bạn có thể vào Gói của tôi để đổi coach (chỉ được đổi coach ngang giá tiền).',
          );
        }

        // CÙNG PT: CỘNG DỒN SỐ BUỔI VÀ GIA HẠN NGÀY HẾT HẠN!
        const additionalDays = snapshot?.durationDays ?? plan.durationDays;
        const stackedSub = await tx.userSubscription.update({
          where: { id: activeSub.id },
          data: {
            remainingSessions: { increment: groupQuota + ptQuota },
            remainingPtSessions: { increment: ptQuota },
            remainingGroupSessions: { increment: groupQuota },
            endDate: addDays(activeSub.endDate, additionalDays),
            ...(givesGymAccess ? { hasUnlimitedGymAccess: true } : {}),
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            invoiceCode: `INV-${randomUUID()}`,
            subscriptionId: stackedSub.id,
            issuerId: actor.userId,
            amount: baseAmount.add(ptAmount),
            baseAmount,
            ptAmount,
            paymentMethod: dto.paymentMethod,
            transactionRef: dto.transactionRef,
            checkoutId,
            type: 'SUBSCRIPTION_NEW',
          },
        });
        await audit(
          tx,
          actor,
          'PURCHASE_SUBSCRIPTION',
          'user_subscriptions',
          stackedSub.id,
          { invoiceId: invoice.id, amount: invoice.amount, stacked: true },
        );
        return { subscription: stackedSub, invoice };
      }
    } else if (plan.packageTier !== 'TRIAL' && plan.packageTier !== 'DROP_IN') {
      // CÙNG GÓI NHÓM / GÓI THÀNH VIÊN (không gán PT): CỘNG DỒN SỐ BUỔI VÀ GIA HẠN NGÀY HẾT HẠN + NGÀY VÀO GYM!
      const activeSamePlanSub = await tx.userSubscription.findFirst({
        where: {
          userId: dto.memberId,
          planId: plan.id,
          status: 'ACTIVE',
          endDate: { gte: localDate() },
          assignedCoachId: null,
          coachRatingStars,
        },
        orderBy: { endDate: 'desc' },
      });

      if (activeSamePlanSub) {
        const additionalDays = snapshot?.durationDays ?? plan.durationDays;
        const stackedSub = await tx.userSubscription.update({
          where: { id: activeSamePlanSub.id },
          data: {
            remainingSessions: { increment: groupQuota + ptQuota },
            remainingPtSessions: { increment: ptQuota },
            remainingGroupSessions: { increment: groupQuota },
            endDate: addDays(activeSamePlanSub.endDate, additionalDays),
            ...(givesGymAccess ? { hasUnlimitedGymAccess: true } : {}),
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            invoiceCode: `INV-${randomUUID()}`,
            subscriptionId: stackedSub.id,
            issuerId: actor.userId,
            amount: baseAmount.add(ptAmount),
            baseAmount,
            ptAmount,
            paymentMethod: dto.paymentMethod,
            transactionRef: dto.transactionRef,
            checkoutId,
            type: 'SUBSCRIPTION_NEW',
          },
        });
        await audit(
          tx,
          actor,
          'PURCHASE_SUBSCRIPTION',
          'user_subscriptions',
          stackedSub.id,
          { invoiceId: invoice.id, amount: invoice.amount, stacked: true },
        );
        return { subscription: stackedSub, invoice };
      }
    }

    const member = await tx.user.findUnique({
      where: { id: dto.memberId },
      select: { fullName: true },
    });

    const planDuration = snapshot?.durationDays ?? plan.durationDays;
    let finalEndDate = addDays(startDate, planDuration - 1);

    // Nếu gói mới có quyền vào phòng gym (ví dụ Gym Plus, Gym VIP, các gói VIP kèm 30 ngày tập gym),
    // và hội viên ĐÃ có gói tập gym đang active, thì cộng dồn số ngày vào phòng gym (tăng hạn hết hạn)
    if (givesGymAccess) {
      const activeGymSub = await tx.userSubscription.findFirst({
        where: {
          userId: dto.memberId,
          status: 'ACTIVE',
          endDate: { gte: localDate() },
          OR: [
            { hasUnlimitedGymAccess: true },
            { discipline: { code: 'GYM' } },
            { packageTier: 'VIP' },
          ],
        },
        orderBy: { endDate: 'desc' },
      });

      if (activeGymSub) {
        // Cộng dồn ngày từ hạn của gói gym đang có
        finalEndDate = addDays(activeGymSub.endDate, planDuration);
        // Đồng thời gia hạn gói gym cũ để ngày vào gym của cả 2 gói đều được kéo dài tương ứng
        await tx.userSubscription.update({
          where: { id: activeGymSub.id },
          data: {
            endDate: finalEndDate,
            hasUnlimitedGymAccess: true,
          },
        });
      }
    }

    const subscription = await tx.userSubscription.create({
      data: {
        userId: dto.memberId,
        planId: plan.id,
        disciplineId: plan.disciplineId,
        packageTier: plan.packageTier,
        coachRatingStars,
        assignedCoachId: dto.coachId,
        assigned_coach_name: coachName,
        member_name: member?.fullName || null,
        startDate,
        endDate: finalEndDate,
        remainingSessions:
          plan.discipline?.code.toUpperCase() === 'GYM' &&
          plan.packageTier === 'DROP_IN'
            ? 1
            : groupQuota + ptQuota,
        remainingGroupSessions: groupQuota,
        remainingPtSessions: ptQuota,
        hasUnlimitedGymAccess: givesGymAccess,
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
        checkoutId,
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
  async fulfillCheckout(
    tx: Prisma.TransactionClient,
    order: CheckoutOrder,
    paymentId: string,
  ) {
    const actor: Actor = { userId: order.memberId, role: UserRole.MEMBER };
    if (order.kind === 'PT_ADDON') {
      const id = requireRecord(
        order.targetSubscriptionId,
        'SUBSCRIPTION_NOT_FOUND',
      );
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id } }),
        'SUBSCRIPTION_NOT_FOUND',
      );
      const today = localDate();
      requireCondition(
        sub.userId === order.memberId &&
          sub.status === 'ACTIVE' &&
          sub.startDate <= today &&
          sub.endDate >= today &&
          sub.assignedCoachId === order.coachId,
        'INVALID_PT_SUBSCRIPTION',
      );
      const sessions = requireRecord(order.addonSessions, 'INVALID_ADDON');
      const subscription = await tx.userSubscription.update({
        where: { id },
        data: {
          remainingPtSessions: { increment: sessions },
          remainingSessions: { increment: sessions },
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          invoiceCode: `INV-${randomUUID()}`,
          subscriptionId: id,
          issuerId: order.memberId,
          amount: order.amount,
          baseAmount: order.baseAmount,
          ptAmount: order.ptAmount,
          paymentMethod: order.amount.isZero() ? 'FREE' : 'MOCK',
          transactionRef: paymentId,
          type: 'PT_ADDON',
          checkoutId: order.id,
        },
      });
      await audit(tx, actor, 'PURCHASE_PT_ADDON', 'user_subscriptions', id, {
        invoiceId: invoice.id,
        checkoutId: order.id,
      });
      return { subscription, invoice };
    }
    const planId = requireRecord(order.planId, 'PLAN_NOT_FOUND');
    const price = order.priceSnapshot as Record<string, unknown>;
    const currentPlan = requireRecord(
      await tx.membershipPlan.findUnique({
        where: { id: planId },
        include: { discipline: true },
      }),
      'PLAN_NOT_FOUND',
    );
    requireCondition(
      currentPlan.disciplineId === price.disciplineId &&
        currentPlan.packageTier === price.packageTier,
      'PLAN_CHANGED_AFTER_CHECKOUT',
    );
    const isGroupPlan =
      currentPlan.trainingMode === 'GROUP_CLASS' ||
      (currentPlan.groupSessionQuota !== null && currentPlan.groupSessionQuota !== undefined && currentPlan.groupSessionQuota > 0) ||
      Number(price.groupQuota) > 0;
    const resolvedPtQuota = isGroupPlan
      ? 0
      : Number(price.ptQuota || (currentPlan.packageTier === 'VIP' ? 12 : currentPlan.ptSessionQuota || 0));
    const resolvedGroupQuota = isGroupPlan
      ? Number(price.groupQuota || currentPlan.groupSessionQuota || 12)
      : Number(price.groupQuota || 0);

    const snapshot = {
      baseAmount: order.baseAmount,
      ptAmount: order.ptAmount,
      ptQuota: resolvedPtQuota,
      groupQuota: resolvedGroupQuota,
      durationDays: Number(price.durationDays || currentPlan.durationDays),
      unlimitedGymEntry: Boolean(price.unlimitedGymEntry ?? currentPlan.unlimitedGymEntry),
      coachRatingStars: Number(price.coachRatingStars || 3),
    };
    const today = localDate();
    if (order.kind === 'RENEWAL') {
      const original = requireRecord(
        order.targetSubscriptionId,
        'SUBSCRIPTION_NOT_FOUND',
      );
      const sub = requireRecord(
        await tx.userSubscription.findUnique({ where: { id: original } }),
        'SUBSCRIPTION_NOT_FOUND',
      );
      requireCondition(
        sub.userId === order.memberId &&
          sub.planId === planId &&
          sub.status !== 'FROZEN' &&
          sub.packageTier !== 'TRIAL' &&
          sub.packageTier !== 'DROP_IN',
        'SUBSCRIPTION_NOT_RENEWABLE',
      );
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${order.memberId}:${planId}`}))`;
      const givesGymAccess =
        currentPlan.discipline?.code?.toUpperCase() === 'GYM' ||
        snapshot.unlimitedGymEntry ||
        currentPlan.packageTier === 'VIP';
      const isStillValid = sub.endDate >= today;
      const newStartDate = isStillValid ? sub.startDate : today;
      const newEndDate = isStillValid
        ? addDays(sub.endDate, snapshot.durationDays)
        : addDays(today, snapshot.durationDays - 1);

      const subscription = await tx.userSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          startDate: newStartDate,
          endDate: newEndDate,
          remainingSessions: { increment: resolvedGroupQuota + resolvedPtQuota },
          remainingGroupSessions: { increment: resolvedGroupQuota },
          remainingPtSessions: { increment: resolvedPtQuota },
          ...(givesGymAccess ? { hasUnlimitedGymAccess: true } : {}),
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          invoiceCode: `INV-${randomUUID()}`,
          subscriptionId: subscription.id,
          issuerId: order.memberId,
          amount: order.amount,
          baseAmount: order.baseAmount,
          ptAmount: order.ptAmount,
          paymentMethod: order.amount.isZero() ? 'FREE' : 'MOCK',
          transactionRef: paymentId,
          type: 'SUBSCRIPTION_NEW',
          checkoutId: order.id,
        },
      });
      await audit(
        tx,
        actor,
        'RENEW_SUBSCRIPTION',
        'user_subscriptions',
        subscription.id,
        { invoiceId: invoice.id, checkoutId: order.id, amount: invoice.amount },
      );
      return { subscription, invoice };
    }
    return this.sell(
      tx,
      {
        memberId: order.memberId,
        planId,
        coachId: order.coachId ?? undefined,
        paymentMethod: order.amount.isZero() ? 'FREE' : 'MOCK',
        transactionRef: paymentId,
      },
      actor,
      today,
      snapshot,
      order.id,
    );
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
  async invoices(actor: Actor, query?: InvoiceListQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);

    const baseWhere =
      actor.role === 'MEMBER'
        ? { subscription: { userId: actor.userId } }
        : query?.memberId
          ? { subscription: { userId: query.memberId } }
          : {};

    const where = {
      ...baseWhere,
      ...(startUtc || endUtc
        ? {
            createdAt: {
              ...(startUtc ? { gte: startUtc } : {}),
              ...(endUtc ? { lte: endUtc } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { subscription: { select: { userId: true, planId: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }
}
