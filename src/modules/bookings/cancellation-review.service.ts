import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireOwner,
  localDate,
} from '../../common/utils/domain';
import {
  CancellationRequestDto,
  ReviewDto,
  PenaltyReviewDto,
} from '../commerce/dto/commerce.dto';
import { BookingsService } from './bookings.service';
@Injectable()
export class CancellationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly bookings: BookingsService,
    private readonly events: DomainEvents,
  ) {}
  async request(
    dto: CancellationRequestDto,
    actor: Actor,
    coachId = actor.userId,
  ) {
    const value = await this.transactions.run(async (tx) => {
      requireCondition(
        Boolean(dto.bookingId) !== Boolean(dto.scheduleId),
        'EXACTLY_ONE_CANCELLATION_TARGET',
      );
      requireCondition(
        !dto.targetType ||
          dto.targetType ===
            (dto.bookingId ? 'PERSONAL_TRAINING' : 'GROUP_CLASS'),
        'CANCELLATION_TARGET_MISMATCH',
      );
      requireCondition(
        dto.reasonMessage.trim().length >= 20,
        'CANCELLATION_REASON_TOO_SHORT',
      );
      const booking = dto.bookingId
        ? requireRecord(
            await tx.booking.findUnique({
              where: { id: dto.bookingId },
              include: { coachAvailability: true },
            }),
          )
        : null;
      const schedule = dto.scheduleId
        ? requireRecord(
            await tx.schedule.findUnique({ where: { id: dto.scheduleId } }),
          )
        : null;
      const target = requireRecord(
        schedule ?? booking?.coachAvailability ?? null,
      );
      requireCondition(target.coachId === coachId, 'COACH_TARGET_MISMATCH');
      if (actor.role === 'COACH') requireOwner(actor, target.coachId);
      else
        requireCondition(
          actor.role === 'RECEPTIONIST' && Boolean(dto.coachId),
          'COACH_REQUIRED',
        );
      await requireRecord(
        await tx.coachProfile.findUnique({ where: { userId: coachId } }),
        'COACH_NOT_FOUND',
      );
      requireCondition(
        target.startTime > new Date(),
        'SESSION_ALREADY_STARTED',
      );
      requireCondition(
        !booking ||
          (booking.status === 'CONFIRMED' &&
            booking.bookingType === 'PERSONAL_TRAINING'),
        'BOOKING_NOT_CANCELLABLE',
      );
      requireCondition(
        !schedule || ['OPEN', 'FULL'].includes(schedule.status),
        'SCHEDULE_CLOSED',
      );
      requireCondition(
        !(await tx.cancellationRequest.findFirst({
          where: {
            status: 'PENDING',
            ...(booking
              ? { bookingId: booking.id }
              : { scheduleId: schedule!.id }),
          },
        })),
        'CANCELLATION_REQUEST_EXISTS',
      );
      const created = await tx.cancellationRequest.create({
        data: {
          coachId,
          bookingId: booking?.id,
          scheduleId: schedule?.id,
          targetType: booking ? 'PERSONAL_TRAINING' : 'GROUP_CLASS',
          reasonMessage: dto.reasonMessage.trim(),
          internalNote: dto.internalNote,
        },
      });
      await audit(
        tx,
        actor,
        'REQUEST_EMERGENCY_CANCELLATION',
        'cancellation_requests',
        created.id,
      );
      return created;
    });
    this.events.publish({
      name: 'cancellation.requested',
      data: value,
      userIds: [...new Set([actor.userId, coachId])],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    return value;
  }
  list(actor: Actor) {
    return this.prisma.cancellationRequest.findMany({
      where: actor.role === 'COACH' ? { coachId: actor.userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async review(id: string, dto: ReviewDto, actor: Actor) {
    requireCondition(
      (dto.approve !== undefined) !== (dto.action !== undefined),
      'EXACTLY_ONE_REVIEW_ACTION',
    );
    const approve = dto.action
      ? dto.action === 'APPROVE'
      : dto.approve === true;
    const result = await this.transactions.run(async (tx) => {
      const request = requireRecord(
        await tx.cancellationRequest.findUnique({ where: { id } }),
      );
      requireCondition(
        !approve ? Boolean(dto.rejectionReason?.trim()) : true,
        'REJECTION_REASON_REQUIRED',
      );
      const claim = await tx.cancellationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          rejectionReason: approve ? null : dto.rejectionReason,
          isFrontdeskOverride: actor.role === 'RECEPTIONIST',
        },
      });
      requireCondition(claim.count === 1, 'REQUEST_ALREADY_REVIEWED');
      const affected: string[] = [];
      if (approve) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.coachId}))`;
        const profile = requireRecord(
          await tx.coachProfile.findUnique({
            where: { userId: request.coachId },
          }),
        );
        const today = localDate();
        if (
          !profile.lastCancellationResetDate ||
          profile.lastCancellationResetDate.toISOString().slice(0, 7) !==
            today.toISOString().slice(0, 7)
        )
          await tx.coachProfile.update({
            where: { userId: request.coachId },
            data: {
              monthlyEmergencyCancellations: 0,
              lastCancellationResetDate: today,
            },
          });
        if (request.scheduleId) {
          const schedule = requireRecord(
            await tx.schedule.findUnique({ where: { id: request.scheduleId } }),
          );
          requireCondition(
            ['OPEN', 'FULL'].includes(schedule.status) &&
              schedule.startTime > new Date(),
            'SCHEDULE_NOT_CANCELLABLE',
          );
          await tx.schedule.update({
            where: { id: schedule.id },
            data: { status: 'CANCELLED_BY_COACH' },
          });
        }
        const bookings = await tx.booking.findMany({
          where: {
            ...(request.scheduleId
              ? { scheduleId: request.scheduleId }
              : { id: request.bookingId! }),
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          include: { coachAvailability: true },
        });
        for (const booking of bookings) {
          if (booking.coachAvailability)
            requireCondition(
              booking.coachAvailability.startTime > new Date(),
              'SESSION_ALREADY_STARTED',
            );
          const claimed = await tx.booking.updateMany({
            where: { id: booking.id, status: { in: ['CONFIRMED', 'PENDING'] } },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: 'COACH',
              isEmergencyCancellation: true,
              cancellationReason: request.reasonMessage,
              isLateCancellation: false,
            },
          });
          if (claimed.count !== 1) continue;
          if (booking.coachAvailabilityId)
            await tx.coachAvailability.update({
              where: { id: booking.coachAvailabilityId },
              data: { isEmergencyCancelled: true },
            });
          await this.bookings.release(tx, booking, true);
          await tx.coachPenalty.updateMany({
            where: { bookingId: booking.id, cancellationRequestId: null },
            data: { cancellationRequestId: id },
          });
          affected.push(booking.memberId);
        }
      }
      await audit(
        tx,
        actor,
        approve
          ? 'APPROVE_EMERGENCY_CANCELLATION'
          : 'REJECT_EMERGENCY_CANCELLATION',
        'cancellation_requests',
        id,
        { frontdeskOverride: actor.role === 'RECEPTIONIST' },
      );
      return {
        request: requireRecord(
          await tx.cancellationRequest.findUnique({ where: { id } }),
        ),
        affected,
        schedule: request.scheduleId
          ? await tx.schedule.findUnique({ where: { id: request.scheduleId } })
          : null,
      };
    });
    this.events.publish({
      name: 'cancellation.reviewed',
      data: result.request,
      userIds: [result.request.coachId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    if (approve && result.schedule)
      this.events.publish({
        name: 'schedule.updated',
        data: {
          scheduleId: result.schedule.id,
          currentEnrolled: result.schedule.currentEnrolled,
          capacity: result.schedule.capacity,
          status: result.schedule.status,
        },
        userIds: [result.request.coachId, ...result.affected],
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
      });
    if (approve && result.affected.length)
      this.events.publish({
        name: 'session.cancelled',
        data: {
          requestId: id,
          scheduleId: result.request.scheduleId,
          bookingId: result.request.bookingId,
          reasonMessage: result.request.reasonMessage,
        },
        userIds: result.affected,
      });
    return {
      ...result.request,
      requestId: id,
      reviewedBy: actor.role,
      refundedCount: result.affected.length,
    };
  }
  penalties(actor: Actor) {
    return this.prisma.coachPenalty.findMany({
      where: actor.role === 'COACH' ? { coachId: actor.userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  penalty(id: string, dto: PenaltyReviewDto, actor: Actor) {
    return this.transactions.run(async (tx) => {
      requireRecord(await tx.coachPenalty.findUnique({ where: { id } }));
      const value = await tx.coachPenalty.update({
        where: { id },
        data: {
          isReviewedByManager: true,
          managerFinalDecision: dto.decision,
          reviewedAt: new Date(),
        },
      });
      await audit(tx, actor, 'REVIEW_COACH_PENALTY', 'coach_penalties', id);
      return value;
    });
  }
}
