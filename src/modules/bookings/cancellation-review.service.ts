import { ForbiddenException, Injectable } from '@nestjs/common';
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
  CancellationRequestQueryDto,
  ReviewDto,
  PenaltyReviewDto,
} from '../commerce/dto/commerce.dto';
import {
  parsePagination,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { BookingsService } from './bookings.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class CancellationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly bookings: BookingsService,
    private readonly events: DomainEvents,
    private readonly email: EmailService,
  ) {}
  async request(
    dto: CancellationRequestDto,
    actor: Actor,
    coachId = actor.userId,
  ) {
    const value = await this.transactions.run(async (tx) => {
      // 1. Auto-sanitize: If client provided both or provided bookingId of a group class, normalize cleanly
      if (dto.scheduleId && dto.bookingId) {
        dto.bookingId = undefined;
      } else if (dto.bookingId && !dto.scheduleId) {
        const checkB = await tx.booking.findUnique({
          where: { id: dto.bookingId },
          select: { id: true, bookingType: true, scheduleId: true },
        });
        if (checkB && checkB.bookingType === 'GROUP_CLASS' && checkB.scheduleId) {
          dto.scheduleId = checkB.scheduleId;
          dto.bookingId = undefined;
        }
      }

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
              include: {
                coachAvailability: true,
                discipline: { select: { code: true, name: true } },
                subscription: {
                  select: {
                    plan: {
                      select: {
                        name: true,
                        packageCategory: true,
                        discipline: { select: { code: true, name: true } },
                      },
                    },
                  },
                },
              },
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
          (['CONFIRMED', 'PENDING'].includes(booking.status) &&
            (booking.bookingType === 'PERSONAL_TRAINING' ||
              Boolean(booking.coachAvailabilityId))),
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
      const planCat = (booking as any)?.subscription?.plan?.packageCategory;
      const discCode = (
        (booking as any)?.discipline?.code ||
        (booking as any)?.subscription?.plan?.discipline?.code ||
        ''
      ).toUpperCase();
      const isGroupBooking = Boolean(
        schedule ||
        booking?.bookingType === 'GROUP_CLASS' ||
        planCat === 'GROUP' ||
        discCode === 'YOGA' ||
        discCode === 'BOXING',
      );
      const created = await tx.cancellationRequest.create({
        data: {
          coachId,
          bookingId: booking?.id,
          scheduleId: schedule?.id,
          targetType: isGroupBooking ? 'GROUP_CLASS' : 'PERSONAL_TRAINING',
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
      data: {
        ...value,
        requestedByReceptionist: actor.role === 'RECEPTIONIST',
      },
      userIds: actor.role === 'RECEPTIONIST' ? [coachId] : [],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    return value;
  }
  async list(actor: Actor, query?: CancellationRequestQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const where = {
      ...(actor.role === 'COACH' ? { coachId: actor.userId } : {}),
      ...(query?.status ? { status: query.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.cancellationRequest.count({ where }),
      this.prisma.cancellationRequest.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingType: true,
              discipline: { select: { id: true, code: true, name: true } },
              coachAvailability: { select: { startTime: true, endTime: true } },
              subscription: {
                select: {
                  plan: {
                    select: {
                      id: true,
                      name: true,
                      packageCategory: true,
                      discipline: { select: { id: true, code: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          schedule: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  discipline: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, total, page, limit };
  }
  async cancel(id: string, actor: Actor) {
    const value = await this.transactions.run(async (tx) => {
      const request = requireRecord(
        await tx.cancellationRequest.findUnique({ where: { id } }),
      );
      if (actor.role === 'COACH') {
        requireOwner(actor, request.coachId);
        if (request.substitutionStatus === 'ACCEPTED') {
          throw new ForbiddenException(
            'Ca này đã có HLV khác nhận dạy thay nên bạn không thể rút lại yêu cầu.',
          );
        }
      }
      requireCondition(request.status === 'PENDING', 'REQUEST_NOT_PENDING');
      const claim = await tx.cancellationRequest.updateMany({
        where: {
          id,
          status: 'PENDING',
          OR: [
            { substitutionStatus: null },
            { substitutionStatus: { not: 'ACCEPTED' } },
          ],
        },
        data: {
          status: 'CANCELLED' as any,
          substituteCoachId: null,
          substituteCoachName: null,
          substitutionStatus: 'NONE',
          substitutionRespondedAt: null,
          substitutionDeclinedReason: null,
        },
      });
      requireCondition(claim.count === 1, 'REQUEST_ALREADY_REVIEWED');
      await audit(
        tx,
        actor,
        'CANCEL_EMERGENCY_REQUEST',
        'cancellation_requests',
        id,
      );
      return requireRecord(
        await tx.cancellationRequest.findUnique({ where: { id } }),
      );
    });
    this.events.publish({
      name: 'cancellation.cancelled',
      data: value,
      userIds: [value.coachId],
      roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
    });
    return value;
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
        const volunteerCoachId =
          dto.substituteCoachId ||
          (request.substituteCoachId && request.substitutionStatus === 'ACCEPTED'
            ? request.substituteCoachId
            : undefined);

        if (dto.holdForSubstitute && !volunteerCoachId) {
          // Tạm hủy: duyệt đơn nghỉ của HLV nhưng giữ nguyên lịch học viên để qua tab Gán HLV dạy thay
          await tx.cancellationRequest.update({
            where: { id },
            data: {
              substitutionStatus: 'NEEDS_SUBSTITUTE',
              internalNote:
                'Quản lý đã tạm hủy ca để chờ phân công HLV dạy thay.',
            },
          });
        } else if (volunteerCoachId && !dto.substituteCoachId) {
          // Đã có HLV khác chủ động xin nhận dạy thay (ACCEPTED) -> Bàn giao ca trực tiếp khi Manager duyệt!
          const subUser = await tx.user.findUnique({
            where: { id: volunteerCoachId },
            select: { id: true, fullName: true },
          });
          if (request.scheduleId) {
            await tx.schedule.update({
              where: { id: request.scheduleId },
              data: {
                coachId: volunteerCoachId,
                coach_name: subUser?.fullName ?? undefined,
              },
            });
          } else if (request.bookingId) {
            const bk = await tx.booking.findUnique({
              where: { id: request.bookingId },
              select: { coachAvailabilityId: true },
            });
            if (bk?.coachAvailabilityId) {
              await tx.coachAvailability.update({
                where: { id: bk.coachAvailabilityId },
                data: {
                  coachId: volunteerCoachId,
                  coach_name: subUser?.fullName ?? undefined,
                },
              });
            }
          }
        } else if (request.scheduleId && dto.substituteCoachId) {
          const schedule = requireRecord(
            await tx.schedule.findUnique({
              where: { id: request.scheduleId },
              include: { class: true },
            }),
          );
          requireCondition(
            ['OPEN', 'FULL'].includes(schedule.status) &&
              schedule.startTime > new Date(),
            'SCHEDULE_NOT_CANCELLABLE',
          );
          const substituteCoach = requireRecord(
            await tx.user.findUnique({
              where: { id: dto.substituteCoachId, role: 'COACH', isActive: true },
              include: { coachProfile: true },
            }),
            'SUBSTITUTE_COACH_NOT_FOUND',
          );
          const hasSpecialty = await tx.coachSpecialty.findFirst({
            where: {
              coachProfile: { userId: substituteCoach.id },
              specialty: { disciplineId: schedule.class.disciplineId },
            },
          });
          requireCondition(hasSpecialty, 'SUBSTITUTE_COACH_DISCIPLINE_MISMATCH');
          const overlap = await tx.schedule.findFirst({
            where: {
              id: { not: schedule.id },
              coachId: substituteCoach.id,
              startTime: { lt: schedule.endTime },
              endTime: { gt: schedule.startTime },
              status: { in: ['OPEN', 'FULL'] },
            },
          });
          requireCondition(!overlap, 'SUBSTITUTE_COACH_SCHEDULE_OVERLAP');

          // Gửi lời mời nhận ca tới HLV dạy thay (chờ HLV đồng ý mới gán chính thức)
          await tx.cancellationRequest.update({
            where: { id },
            data: {
              substituteCoachId: substituteCoach.id,
              substituteCoachName: substituteCoach.fullName,
              substitutionStatus: 'PENDING_ACCEPTANCE',
              internalNote: `Quản lý đã đề xuất HLV ${substituteCoach.fullName} dạy thay ca này. Đang chờ HLV đồng ý xác nhận.`,
            },
          });

          this.events.publish({
            name: 'schedule.updated',
            data: {
              scheduleId: schedule.id,
              substituteCoachId: substituteCoach.id,
              substituteCoachName: substituteCoach.fullName,
              status: schedule.status,
              substitutionStatus: 'PENDING_ACCEPTANCE',
            },
            userIds: [request.coachId, substituteCoach.id],
            roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
          });
        } else {
          let cancelledSchedule: any = null;
          if (request.scheduleId) {
            cancelledSchedule = requireRecord(
              await tx.schedule.findUnique({
                where: { id: request.scheduleId },
                include: { class: true, room: true, coach: true },
              }),
            );
            requireCondition(
              ['OPEN', 'FULL'].includes(cancelledSchedule.status) &&
                cancelledSchedule.startTime > new Date(),
              'SCHEDULE_NOT_CANCELLABLE',
            );
            await tx.schedule.update({
              where: { id: cancelledSchedule.id },
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
            include: { coachAvailability: true, member: true },
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

            // Gửi email thành thật cáo lỗi & xác nhận hoàn trả token cho từng học viên
            if (booking.member?.email) {
              const formatHn = (d: Date) =>
                new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: 'Asia/Ho_Chi_Minh',
                }).format(d);

              const sTime = cancelledSchedule?.startTime || booking.coachAvailability?.startTime || new Date();
              const eTime = cancelledSchedule?.endTime || booking.coachAvailability?.endTime || new Date();

              void this.email.sendClassCancelledApologyMemberEmail(
                booking.member.email,
                booking.member.fullName || 'Hội viên',
                {
                  className: cancelledSchedule?.class?.name || 'Ca tập cá nhân (PT 1-1)',
                  startTime: formatHn(sTime),
                  endTime: formatHn(eTime),
                  roomName: cancelledSchedule?.room?.name,
                  coachName: cancelledSchedule?.coach?.fullName || 'HLV',
                  reason: request.reasonMessage,
                },
              );
            }
          }
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
      const reqFull = requireRecord(
        await tx.cancellationRequest.findUnique({
          where: { id },
          include: {
            coach: { select: { id: true, fullName: true } },
            schedule: { include: { class: true } },
            booking: {
              include: {
                coachAvailability: true,
                subscription: { include: { plan: true } },
              },
            },
          },
        }),
      );
      return {
        request: reqFull,
        affected,
        schedule: reqFull.schedule,
      };
    });
    const formatHn = (d?: Date | null) =>
      d
        ? new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(d)
        : '';
    const sessionStart =
      result.schedule?.startTime ||
      result.request.booking?.coachAvailability?.startTime ||
      null;
    const sessionTime = formatHn(sessionStart);
    const sessionTitle =
      result.schedule?.class?.name ||
      result.request.booking?.subscription?.plan?.name ||
      'Ca tập cá nhân (PT 1-1)';

    this.events.publish({
      name: 'cancellation.reviewed',
      data: {
        ...result.request,
        sessionTitle,
        sessionTime,
        coachName: result.request.coach?.fullName || 'HLV',
      },
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
          coachMessage: `Đơn xin nghỉ lớp ${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã được phê duyệt. Học viên đã được hoàn 100% lượt tập.`,
          memberMessage: `Lớp ${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã bị hủy do HLV có việc đột xuất. 100% lượt tập đã được hoàn lại.`,
          message: `Lớp ${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã được cập nhật trạng thái hủy.`,
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
          sessionTitle,
          sessionTime,
          reasonMessage: result.request.reasonMessage,
          message: `${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã bị hủy do HLV xin nghỉ đột xuất. Lượt tập đã được hoàn trả 100% vào gói của bạn.`,
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
  async penalties(actor: Actor, query?: PaginationQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const where = actor.role === 'COACH' ? { coachId: actor.userId } : {};
    const [total, items] = await Promise.all([
      this.prisma.coachPenalty.count({ where }),
      this.prisma.coachPenalty.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return { items, total, page, limit };
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
