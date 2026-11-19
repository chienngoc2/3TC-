import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckoutOrder, CheckoutStatus, Prisma, UserRole } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import { PayosService } from '../../infrastructure/payos/payos.service';
import type { Actor } from '../../common/types/actor';
import {
  localDate,
  requireCondition,
  requireRecord,
  requireRole,
} from '../../common/utils/domain';
import { BillingService } from './billing.service';
import { CheckoutListDto, CreateCheckoutDto } from './checkout.dto';

type Outcome = 'SUCCESS' | 'FAILURE';
type MockEvent = {
  eventId: string;
  paymentId: string;
  checkoutId: string;
  amount: string;
  currency: string;
  merchant: 'MOCK';
  outcome: Outcome;
};

class FulfillmentEligibilityError extends Error {}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly lookups = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly billing: BillingService,
    private readonly events: DomainEvents,
    private readonly payos: PayosService,
  ) {}

  vipQuote(planId: string, coachId: string) {
    return this.billing.vipQuote(planId, coachId);
  }

  addonPreview(id: string, sessions: number, actor: Actor) {
    return this.billing.addonPreview(id, sessions, actor);
  }

  private key(value?: string) {
    if (!value || !/^[\w-]{8,100}$/.test(value))
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    return value;
  }

  private paymentId() {
    return randomBytes(8).toString('hex').toUpperCase();
  }

  private generateOrderCode(): number {
    return Number(
      String(Math.floor(Date.now() / 1000)).slice(-6) +
        String(Math.floor(1000 + Math.random() * 9000)),
    );
  }

  private enabled() {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.MOCK_PAYMENT_ENABLED !== 'true'
    )
      throw new NotFoundException('MOCK_PAYMENT_DISABLED');
    if (
      !process.env.MOCK_WEBHOOK_SECRET ||
      process.env.MOCK_WEBHOOK_SECRET.length < 32
    )
      throw new ServiceUnavailableException(
        'MOCK_WEBHOOK_SECRET_NOT_CONFIGURED',
      );
    return process.env.MOCK_WEBHOOK_SECRET;
  }

  private throttle(ip?: string) {
    const key = ip ?? 'unknown';
    const now = Date.now();
    const previous = this.lookups.get(key);
    const next =
      previous && previous.until > now
        ? { count: previous.count + 1, until: previous.until }
        : { count: 1, until: now + 60000 };
    this.lookups.set(key, next);
    if (this.lookups.size > 1000)
      for (const [address, entry] of this.lookups)
        if (entry.until <= now) this.lookups.delete(address);
    if (next.count > 20)
      throw new ConflictException('MOCK_PAYMENT_RATE_LIMITED');
  }

  private present(
    order: CheckoutOrder & {
      attempts?: { paymentId: string; status: string }[];
      invoice?: { id: string } | null;
    },
  ) {
    const snapshot = (order.priceSnapshot ?? {}) as Record<string, any>;
    const payos = snapshot.payos as
      | {
          orderCode?: number;
          checkoutUrl?: string;
          qrCode?: string;
          accountNumber?: string;
          accountName?: string;
          bin?: string;
        }
      | undefined;

    return {
      checkoutId: order.id,
      kind: order.kind,
      status: order.status,
      amount: order.amount,
      baseAmount: order.baseAmount,
      ptAmount: order.ptAmount,
      currency: order.currency,
      priceSnapshot: order.priceSnapshot,
      paymentId: order.attempts?.[0]?.paymentId ?? null,
      paymentUrl:
        order.amount.isZero()
          ? null
          : (payos?.checkoutUrl ?? (this.mockAvailable() ? '/mock-payment' : null)),
      qrCode: payos?.qrCode ?? null,
      orderCode: payos?.orderCode ?? null,
      accountNumber: payos?.accountNumber ?? null,
      accountName: payos?.accountName ?? null,
      bin: payos?.bin ?? null,
      expiresAt: order.expiresAt,
      subscriptionId: order.fulfilledSubscriptionId,
      invoiceId: order.invoice?.id ?? null,
      failureReason: order.failureReason,
      createdAt: order.createdAt,
    };
  }

  private async orderFor(id: string, actor: Actor) {
    const order = requireRecord(
      await this.prisma.checkoutOrder.findUnique({
        where: { id },
        include: {
          attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
          invoice: { select: { id: true } },
        },
      }),
      'CHECKOUT_NOT_FOUND',
    );
    const isStaff =
      actor.role === UserRole.RECEPTIONIST ||
      actor.role === UserRole.CENTER_MANAGER ||
      actor.role === UserRole.ADMIN;
    if (!isStaff && order.memberId !== actor.userId)
      throw new ForbiddenException('FORBIDDEN_RESOURCE');
    return order;
  }

  async create(dto: CreateCheckoutDto, keyValue: string, actor: Actor) {
    const key = this.key(keyValue);
    const targetMemberId: string =
      actor.role === UserRole.RECEPTIONIST ||
      actor.role === UserRole.CENTER_MANAGER
        ? requireRecord(dto.memberId ?? null, 'MEMBER_ID_REQUIRED')
        : actor.userId;
    const normalized = {
      kind: dto.kind,
      memberId: targetMemberId,
      planId: dto.planId ?? null,
      coachId: dto.coachId ?? null,
      subscriptionId: dto.subscriptionId ?? null,
      addonSessions: dto.addonSessions ?? null,
    };
    const requestHash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    const result = await this.transactions.run(async (tx) => {
      await requireRole(tx, targetMemberId, UserRole.MEMBER);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${targetMemberId}`}))`;
      const existing = await tx.checkoutOrder.findUnique({
        where: {
          memberId_idempotencyKey: {
            memberId: targetMemberId,
            idempotencyKey: key,
          },
        },
        include: {
          attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
          invoice: { select: { id: true } },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        return existing;
      }

      let planId: string | null = null;
      let targetSubscriptionId: string | null = null;
      let coachId: string | null = null;
      let addonSessions: number | null = null;
      let baseAmount = new Prisma.Decimal(0);
      let ptAmount = new Prisma.Decimal(0);
      let snapshot: Prisma.InputJsonObject;

      if (dto.kind === 'NEW_SUBSCRIPTION') {
        requireCondition(
          dto.planId && !dto.subscriptionId && !dto.addonSessions,
          'INVALID_CHECKOUT_FIELDS',
        );
        const plan = requireRecord(
          await tx.membershipPlan.findUnique({ where: { id: dto.planId } }),
          'PLAN_NOT_FOUND',
        );
        requireCondition(plan.isActive, 'PLAN_DISABLED');
        planId = plan.id;
        coachId = dto.coachId ?? null;
        const ptQuota =
          plan.packageTier === 'VIP' ? 12 : (plan.ptSessionQuota ?? 0);
        requireCondition(
          Boolean(coachId) === ptQuota > 0,
          'COACH_SELECTION_INVALID',
        );
        if (plan.packageTier === 'TRIAL')
          requireCondition(
            !(await tx.userSubscription.findFirst({
              where: {
                userId: targetMemberId,
                disciplineId: plan.disciplineId,
                packageTier: 'TRIAL',
              },
            })),
            'TRIAL_ALREADY_USED',
          );
        const rate = coachId
          ? await this.billing.rate(tx, coachId, plan.disciplineId)
          : new Prisma.Decimal(0);
        baseAmount = plan.price;
        ptAmount = rate.mul(ptQuota);
        snapshot = {
          planName: plan.name,
          planId: plan.id,
          disciplineId: plan.disciplineId,
          packageTier: plan.packageTier,
          ptQuota,
          groupQuota: plan.groupSessionQuota ?? 0,
          durationDays: plan.durationDays,
          unlimitedGymEntry: Boolean(plan.unlimitedGymEntry),
          coachId,
          ratePerSession: rate.toString(),
        };
      } else {
        requireCondition(
          dto.subscriptionId && !dto.planId,
          'INVALID_CHECKOUT_FIELDS',
        );
        const sub = requireRecord(
          await tx.userSubscription.findUnique({
            where: { id: dto.subscriptionId },
            include: { plan: true },
          }),
          'SUBSCRIPTION_NOT_FOUND',
        );
        requireCondition(sub.userId === targetMemberId, 'FORBIDDEN_RESOURCE');
        targetSubscriptionId = sub.id;
        planId = sub.planId;
        coachId = sub.assignedCoachId;
        if (dto.kind === 'RENEWAL') {
          requireCondition(
            !dto.coachId && !dto.addonSessions,
            'INVALID_CHECKOUT_FIELDS',
          );
          requireCondition(
            sub.packageTier !== 'TRIAL' &&
              sub.packageTier !== 'DROP_IN' &&
              sub.status !== 'FROZEN' &&
              sub.plan.isActive,
            'SUBSCRIPTION_NOT_RENEWABLE',
          );
          const ptQuota =
            sub.plan.packageTier === 'VIP'
              ? 12
              : (sub.plan.ptSessionQuota ?? 0);
          const rate = coachId
            ? await this.billing.rate(tx, coachId, sub.disciplineId)
            : new Prisma.Decimal(0);
          baseAmount = sub.plan.price;
          ptAmount = rate.mul(ptQuota);
          snapshot = {
            planName: sub.plan.name,
            planId: sub.planId,
            disciplineId: sub.disciplineId,
            packageTier: sub.packageTier,
            ptQuota,
            groupQuota: sub.plan.groupSessionQuota ?? 0,
            durationDays: sub.plan.durationDays,
            unlimitedGymEntry: Boolean(sub.plan.unlimitedGymEntry),
            coachId,
            ratePerSession: rate.toString(),
          };
        } else if (dto.kind === 'PT_ADDON') {
          requireCondition(
            !dto.coachId && dto.addonSessions,
            'INVALID_CHECKOUT_FIELDS',
          );
          const today = localDate();
          requireCondition(
            sub.status === 'ACTIVE' &&
              sub.startDate <= today &&
              sub.endDate >= today &&
              coachId,
            'INVALID_PT_SUBSCRIPTION',
          );
          addonSessions = dto.addonSessions;
          const rate = await this.billing.rate(tx, coachId, sub.disciplineId);
          ptAmount = rate.mul(addonSessions);
          snapshot = {
            planName: sub.plan.name,
            subscriptionId: sub.id,
            disciplineId: sub.disciplineId,
            coachId,
            addonSessions,
            ratePerSession: rate.toString(),
          };
        } else throw new BadRequestException('INVALID_CHECKOUT_KIND');
      }

      const amount = baseAmount.add(ptAmount);
      const order = await tx.checkoutOrder.create({
        data: {
          memberId: targetMemberId,
          kind: dto.kind,
          planId,
          targetSubscriptionId,
          coachId,
          addonSessions,
          baseAmount,
          ptAmount,
          amount,
          priceSnapshot: snapshot as Prisma.InputJsonValue,
          idempotencyKey: key,
          requestHash,
          expiresAt: new Date(Date.now() + 15 * 60000),
        },
      });
      if (amount.isZero()) {
        const sold = await this.billing.fulfillCheckout(
          tx,
          order,
          `FREE-${order.id}`,
        );
        const fulfilled = await tx.checkoutOrder.update({
          where: { id: order.id },
          data: {
            status: 'FULFILLED',
            fulfilledSubscriptionId: sold.subscription.id,
          },
        });
        return { ...fulfilled, attempts: [], invoice: { id: sold.invoice.id } };
      }

      let paymentId = this.paymentId();
      let payosData: any = null;

      if (this.payos.isConfigured()) {
        const orderCode = this.generateOrderCode();
        paymentId = String(orderCode);
        const description = `3TC ${String(orderCode).slice(-8)}`;
        try {
          payosData = await this.payos.createPaymentLink({
            orderCode,
            amount: Number(amount),
            description,
            checkoutId: order.id,
            items: [
              {
                name: String(
                  (snapshot as Record<string, any>).planName ?? 'Goi tap',
                ).slice(0, 50),
                quantity: 1,
                price: Number(amount),
              },
            ],
          });
        } catch (error) {
          this.logger.error(`Failed to create PayOS link for checkout ${order.id}:`, error);
        }
      }

      let updatedOrder = order;
      if (payosData) {
        updatedOrder = await tx.checkoutOrder.update({
          where: { id: order.id },
          data: {
            priceSnapshot: {
              ...(snapshot as Record<string, any>),
              payos: payosData,
            },
          },
        });
      }

      const attempt = await tx.paymentAttempt.create({
        data: { checkoutId: order.id, paymentId },
      });
      return { ...updatedOrder, attempts: [attempt], invoice: null };
    });
    if (result.status === 'FULFILLED') await this.changed(result);
    return this.present(result);
  }

  async detail(id: string, actor: Actor) {
    const order = await this.orderFor(id, actor);
    if (order.status === 'PENDING_PAYMENT' && order.expiresAt < new Date()) {
      await this.prisma.checkoutOrder.updateMany({
        where: { id, status: 'PENDING_PAYMENT' },
        data: { status: 'EXPIRED' },
      });
      return this.present(await this.orderFor(id, actor));
    }
    return this.present(order);
  }

  async list(query: CheckoutListDto, actor: Actor) {
    const limit = query.limit ?? 20;
    const isStaff =
      actor.role === UserRole.RECEPTIONIST ||
      actor.role === UserRole.CENTER_MANAGER ||
      actor.role === UserRole.ADMIN;
    const targetMemberId = isStaff
      ? (query.memberId ?? undefined)
      : actor.userId;

    if (targetMemberId) {
      await this.prisma.checkoutOrder.updateMany({
        where: {
          memberId: targetMemberId,
          status: 'PENDING_PAYMENT',
          expiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      });
    }
    const rows = await this.prisma.checkoutOrder.findMany({
      where: {
        ...(targetMemberId ? { memberId: targetMemberId } : {}),
        status: query.status,
      },
      include: {
        attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
        invoice: { select: { id: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, limit).map((row) => this.present(row)),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async retry(id: string, keyValue: string, actor: Actor) {
    const key = this.key(keyValue);
    const result = await this.transactions.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${id}`}))`;
      const order = requireRecord(
        await tx.checkoutOrder.findUnique({ where: { id } }),
        'CHECKOUT_NOT_FOUND',
      );
      const isStaff =
        actor.role === UserRole.RECEPTIONIST ||
        actor.role === UserRole.CENTER_MANAGER ||
        actor.role === UserRole.ADMIN;
      if (!isStaff && order.memberId !== actor.userId)
        throw new ForbiddenException('FORBIDDEN_RESOURCE');
      const existing = await tx.paymentAttempt.findUnique({
        where: { checkoutId_retryKey: { checkoutId: id, retryKey: key } },
      });
      if (existing) return existing;
      requireCondition(
        order.status === 'PAYMENT_FAILED' && order.expiresAt > new Date(),
        'CHECKOUT_NOT_RETRYABLE',
      );

      let paymentId = this.paymentId();
      let payosData: any = null;

      if (this.payos.isConfigured()) {
        const orderCode = this.generateOrderCode();
        paymentId = String(orderCode);
        const description = `3TC ${String(orderCode).slice(-8)}`;
        try {
          payosData = await this.payos.createPaymentLink({
            orderCode,
            amount: Number(order.amount),
            description,
            checkoutId: order.id,
          });
        } catch (error) {
          this.logger.error(
            `Failed to create PayOS link on retry for checkout ${order.id}:`,
            error,
          );
        }
      }

      const snapshot = (order.priceSnapshot ?? {}) as Record<string, any>;
      if (payosData) {
        snapshot.payos = payosData;
      }

      const attempt = await tx.paymentAttempt.create({
        data: { checkoutId: id, paymentId, retryKey: key },
      });
      await tx.checkoutOrder.update({
        where: { id },
        data: {
          status: 'PENDING_PAYMENT',
          failureReason: null,
          priceSnapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return attempt;
    });
    return this.present(await this.orderFor(result.checkoutId, actor));
  }

  async reconcile(id: string, actor: Actor) {
    this.throttle(`reconcile:${id}`);
    const order = await this.orderFor(id, actor);
    if (order.status !== 'PENDING_PAYMENT') return this.present(order);
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { checkoutId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (attempt?.paymentId && this.payos.isConfigured()) {
      const orderCode = Number(attempt.paymentId);
      if (!Number.isNaN(orderCode)) {
        try {
          const linkInfo = await this.payos.getPaymentLink(orderCode);
          if (linkInfo?.status === 'PAID') {
            await this.fulfillOrderFromPayment({
              checkoutId: id,
              paymentId: attempt.paymentId,
              provider: 'PAYOS',
              eventId: `RECONCILE-${orderCode}-${Date.now()}`,
            });
            return this.present(await this.orderFor(id, actor));
          } else if (
            linkInfo?.status === 'CANCELLED' ||
            linkInfo?.status === 'EXPIRED'
          ) {
            await this.prisma.checkoutOrder.update({
              where: { id },
              data: {
                status: 'PAYMENT_FAILED',
                failureReason: `PAYOS_${linkInfo.status}`,
              },
            });
            await this.prisma.paymentAttempt.updateMany({
              where: { paymentId: attempt.paymentId },
              data: { status: 'FAILED' },
            });
            return this.present(await this.orderFor(id, actor));
          }
        } catch (error) {
          this.logger.error(
            `Error querying PayOS for orderCode ${orderCode}:`,
            error,
          );
        }
      }
    }

    if (attempt?.simulationOutcome && this.mockAvailable())
      await this.dispatch(attempt.paymentId);
    return this.present(await this.orderFor(id, actor));
  }

  private mockAvailable() {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.MOCK_PAYMENT_ENABLED === 'true'
    );
  }

  async mockLookup(paymentId: string, ip?: string) {
    this.enabled();
    this.throttle(`ip:${ip ?? 'unknown'}`);
    this.throttle(`payment:${paymentId}`);
    const attempt = requireRecord(
      await this.prisma.paymentAttempt.findUnique({
        where: { paymentId },
        include: { checkout: true },
      }),
      'PAYMENT_ID_NOT_FOUND',
    );
    const order = attempt.checkout;
    requireCondition(
      attempt.status === 'PENDING' &&
        order.status === 'PENDING_PAYMENT' &&
        order.expiresAt > new Date(),
      'PAYMENT_ID_NOT_ACTIVE',
    );
    const snapshot = order.priceSnapshot as { planName?: string };
    return {
      paymentId,
      planName: snapshot.planName ?? 'PT add-on',
      amount: order.amount,
      currency: order.currency,
      expiresAt: order.expiresAt,
      status: order.status,
    };
  }

  async simulate(paymentId: string, outcome: Outcome, ip?: string) {
    this.enabled();
    this.throttle(`ip:${ip ?? 'unknown'}`);
    this.throttle(`payment:${paymentId}`);
    await this.transactions.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mock:${paymentId}`}))`;
      const attempt = requireRecord(
        await tx.paymentAttempt.findUnique({
          where: { paymentId },
          include: { checkout: true },
        }),
        'PAYMENT_ID_NOT_FOUND',
      );
      if (attempt.simulationOutcome) {
        if (attempt.simulationOutcome !== outcome)
          throw new ConflictException('MOCK_OUTCOME_ALREADY_CHOSEN');
        return;
      }
      requireCondition(
        attempt.checkout.expiresAt > new Date(),
        'CHECKOUT_EXPIRED',
      );
      requireCondition(
        attempt.status === 'PENDING' &&
          attempt.checkout.status === 'PENDING_PAYMENT',
        'PAYMENT_ID_NOT_ACTIVE',
      );
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { simulationOutcome: outcome, simulationEventId: randomUUID() },
      });
    });
    await this.dispatch(paymentId);
    const attempt = requireRecord(
      await this.prisma.paymentAttempt.findUnique({ where: { paymentId } }),
      'PAYMENT_ID_NOT_FOUND',
    );
    return {
      paymentId,
      outcome,
      checkoutId: attempt.checkoutId,
      status: (
        await this.prisma.checkoutOrder.findUniqueOrThrow({
          where: { id: attempt.checkoutId },
        })
      ).status,
    };
  }

  private async dispatch(paymentId: string) {
    const secret = this.enabled();
    const attempt = requireRecord(
      await this.prisma.paymentAttempt.findUnique({
        where: { paymentId },
        include: { checkout: true },
      }),
      'PAYMENT_ID_NOT_FOUND',
    );
    const event: MockEvent = {
      eventId: requireRecord(
        attempt.simulationEventId,
        'SIMULATION_NOT_STARTED',
      ),
      paymentId,
      checkoutId: attempt.checkoutId,
      amount: attempt.checkout.amount.toString(),
      currency: attempt.checkout.currency,
      merchant: 'MOCK',
      outcome: attempt.simulationOutcome as Outcome,
    };
    const body = JSON.stringify(event);
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await fetch(
      `http://127.0.0.1:${process.env.PORT ?? '3000'}/api/v1/billing/webhooks/mock`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mock-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('MOCK_WEBHOOK_DELIVERY_FAILED');
  }

  async mockWebhook(rawBody?: Buffer, signature?: string) {
    const secret = this.enabled();
    if (!rawBody || !signature || !/^[a-f0-9]{64}$/.test(signature))
      throw new UnauthorizedException('MOCK_WEBHOOK_SIGNATURE_INVALID');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException('MOCK_WEBHOOK_SIGNATURE_INVALID');
    let event: MockEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as MockEvent;
    } catch {
      throw new BadRequestException('MOCK_WEBHOOK_PAYLOAD_INVALID');
    }
    if (
      event.merchant !== 'MOCK' ||
      !['SUCCESS', 'FAILURE'].includes(event.outcome) ||
      !event.eventId ||
      !event.paymentId ||
      !event.checkoutId
    )
      throw new BadRequestException('MOCK_WEBHOOK_PAYLOAD_INVALID');
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    let changed = false;
    let order: CheckoutOrder;
    try {
      order = await this.transactions.run(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${event.checkoutId}`}))`;
        const attempt = requireRecord(
          await tx.paymentAttempt.findUnique({
            where: { paymentId: event.paymentId },
          }),
          'PAYMENT_ID_NOT_FOUND',
        );
        const current = requireRecord(
          await tx.checkoutOrder.findUnique({
            where: { id: event.checkoutId },
          }),
          'CHECKOUT_NOT_FOUND',
        );
        if (
          attempt.checkoutId !== current.id ||
          attempt.simulationEventId !== event.eventId ||
          attempt.simulationOutcome !== event.outcome ||
          current.amount.toString() !== event.amount ||
          current.currency !== event.currency
        )
          throw new BadRequestException('MOCK_WEBHOOK_MISMATCH');
        const previous = await tx.paymentWebhookEvent.findUnique({
          where: {
            provider_eventId: { provider: 'MOCK', eventId: event.eventId },
          },
        });
        if (previous) {
          if (previous.payloadHash !== payloadHash)
            throw new ConflictException('WEBHOOK_EVENT_REUSED');
          return current;
        }
        await tx.paymentWebhookEvent.create({
          data: {
            checkoutId: current.id,
            provider: 'MOCK',
            eventId: event.eventId,
            payloadHash,
            outcome: event.outcome,
          },
        });
        if (current.status !== 'PENDING_PAYMENT') {
          if (event.outcome === 'SUCCESS' && current.status !== 'FULFILLED') {
            changed = true;
            return tx.checkoutOrder.update({
              where: { id: current.id },
              data: {
                status: 'PAYMENT_REVIEW',
                failureReason: 'PAYMENT_AFTER_CLOSED_ORDER',
              },
            });
          }
          return current;
        }
        changed = true;
        if (event.outcome === 'FAILURE') {
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'FAILED' },
          });
          return tx.checkoutOrder.update({
            where: { id: current.id },
            data: { status: 'PAYMENT_FAILED' },
          });
        }
        if (current.expiresAt < new Date())
          return tx.checkoutOrder.update({
            where: { id: current.id },
            data: {
              status: 'PAYMENT_REVIEW',
              failureReason: 'PAYMENT_AFTER_EXPIRY',
            },
          });
        let sold: Awaited<ReturnType<BillingService['fulfillCheckout']>>;
        try {
          sold = await this.billing.fulfillCheckout(
            tx,
            current,
            event.paymentId,
          );
        } catch (error) {
          if (
            error instanceof BadRequestException ||
            error instanceof NotFoundException ||
            error instanceof ConflictException
          )
            throw new FulfillmentEligibilityError(error.message);
          throw error;
        }
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED' },
        });
        return tx.checkoutOrder.update({
          where: { id: current.id },
          data: {
            status: 'FULFILLED',
            fulfilledSubscriptionId: sold.subscription.id,
          },
        });
      });
    } catch (error) {
      if (
        event.outcome !== 'SUCCESS' ||
        !(error instanceof FulfillmentEligibilityError)
      )
        throw error;
      order = await this.transactions.run(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${event.checkoutId}`}))`;
        const current = requireRecord(
          await tx.checkoutOrder.findUnique({
            where: { id: event.checkoutId },
          }),
          'CHECKOUT_NOT_FOUND',
        );
        if (current.status !== 'PENDING_PAYMENT') return current;
        await tx.paymentWebhookEvent.create({
          data: {
            checkoutId: current.id,
            provider: 'MOCK',
            eventId: event.eventId,
            payloadHash,
            outcome: event.outcome,
          },
        });
        changed = true;
        return tx.checkoutOrder.update({
          where: { id: current.id },
          data: {
            status: 'PAYMENT_REVIEW',
            failureReason: 'FULFILLMENT_ELIGIBILITY_FAILED',
          },
        });
      });
    }
    if (changed) await this.changed(order);
    return { checkoutId: order.id, status: order.status };
  }

  async payosWebhook(body: any) {
    if (!body) {
      throw new BadRequestException('PAYOS_WEBHOOK_BODY_REQUIRED');
    }

    const verified = await this.payos.verifyWebhook(body);
    if (!verified) {
      this.logger.warn('PayOS webhook verification failed: invalid signature');
      throw new UnauthorizedException('PAYOS_WEBHOOK_SIGNATURE_INVALID');
    }

    const { orderCode, reference, code } = verified;
    this.logger.log(
      `Received PayOS webhook for orderCode ${orderCode}, code: ${code}`,
    );

    const paymentId = String(orderCode);
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { paymentId },
    });

    if (!attempt) {
      this.logger.warn(
        `PayOS webhook orderCode ${orderCode} not matched with any local payment attempt (likely a test ping)`,
      );
      return { success: true, message: 'Webhook test received' };
    }

    if (code === '00') {
      const eventId = `${orderCode}-${reference || Date.now()}`;
      await this.fulfillOrderFromPayment({
        checkoutId: attempt.checkoutId,
        paymentId,
        provider: 'PAYOS',
        eventId,
      });
      return { success: true, message: 'Order fulfilled successfully' };
    } else {
      this.logger.warn(
        `PayOS payment not successful for orderCode ${orderCode}, code: ${code}`,
      );
      return { success: true, message: 'Payment incomplete' };
    }
  }

  private async fulfillOrderFromPayment(params: {
    checkoutId: string;
    paymentId: string;
    provider: string;
    eventId: string;
    payloadHash?: string;
  }) {
    const { checkoutId, paymentId, provider, eventId } = params;
    const payloadHash =
      params.payloadHash ??
      createHash('sha256').update(`${provider}:${eventId}`).digest('hex');

    let changed = false;
    const order = await this.transactions.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${checkoutId}`}))`;
      const current = requireRecord(
        await tx.checkoutOrder.findUnique({
          where: { id: checkoutId },
        }),
        'CHECKOUT_NOT_FOUND',
      );
      const attempt = requireRecord(
        await tx.paymentAttempt.findUnique({
          where: { paymentId },
        }),
        'PAYMENT_ID_NOT_FOUND',
      );

      const previous = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_eventId: { provider, eventId },
        },
      });
      if (previous) {
        return current;
      }

      await tx.paymentWebhookEvent.create({
        data: {
          checkoutId: current.id,
          provider,
          eventId,
          payloadHash,
          outcome: 'SUCCESS',
        },
      });

      if (current.status !== 'PENDING_PAYMENT') {
        return current;
      }

      changed = true;
      if (current.expiresAt < new Date()) {
        return tx.checkoutOrder.update({
          where: { id: current.id },
          data: {
            status: 'PAYMENT_REVIEW',
            failureReason: 'PAYMENT_AFTER_EXPIRY',
          },
        });
      }

      const sold = await this.billing.fulfillCheckout(
        tx,
        current,
        paymentId,
      );

      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUCCEEDED' },
      });

      return tx.checkoutOrder.update({
        where: { id: current.id },
        data: {
          status: 'FULFILLED',
          fulfilledSubscriptionId: sold.subscription.id,
        },
      });
    });

    if (changed) {
      await this.changed(order);
    }

    return order;
  }

  private async changed(order: CheckoutOrder) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { checkoutId: order.id },
      select: { id: true },
    });
    this.events.publish({
      name: 'checkout.updated',
      userIds: [order.memberId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      data: {
        checkoutId: order.id,
        status: order.status,
        subscriptionId: order.fulfilledSubscriptionId,
        invoiceId: invoice?.id ?? null,
      },
    });
    if (order.status === CheckoutStatus.FULFILLED) {
      this.events.publish({
        name: 'checkout.paid',
        userIds: [order.memberId],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          checkoutId: order.id,
          status: order.status,
          subscriptionId: order.fulfilledSubscriptionId,
          invoiceId: invoice?.id ?? null,
        },
      });
    }
  }
}
