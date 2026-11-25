import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import { DomainEvents } from '../../common/events/domain-events';
import { EmailService } from '../auth/email.service';
import type { Actor } from '../../common/types/actor';
import {
  audit,
  requireRecord,
  requireCondition,
  requireRole,
  timeRange,
} from '../../common/utils/domain';
import {
  ScheduleDto,
  ScheduleQueryDto,
  UpdateScheduleDto,
  ManagerScheduleOverrideDto,
} from '../commerce/dto/commerce.dto';
import {
  getVietnamDateRange,
  getVietnamDayBounds,
} from '../../common/utils/timezone';
import {
  getClassSpecialtyCode,
  SPECIALTY_NAME_MAP,
  getSpecialtyDedicatedRoomName,
  isClassCompatibleWithPlan,
} from '../../common/utils/topic-matcher';
import { isWithinCoachProfileSchedule } from '../../common/utils/coach-availability';

@Injectable()
export class SchedulesService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesService.name);
  private lastThresholdCheckAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
    private readonly events: DomainEvents,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    // Run initial checks on startup
    this.lastThresholdCheckAt = Date.now();
    void this.autoCancelUnderEnrolledSchedules();
    void this.autoCancelUnsubstitutedEmergencySchedules();
    // Periodically check every 5 minutes (cho các ca trước 30 phút và các ca thiếu sĩ số)
    setInterval(() => {
      this.lastThresholdCheckAt = Date.now();
      void this.autoCancelUnderEnrolledSchedules();
      void this.autoCancelUnsubstitutedEmergencySchedules();
    }, 5 * 60 * 1000);
  }

  private triggerStaleThresholdChecks() {
    const now = Date.now();
    if (now - this.lastThresholdCheckAt < 60_000) return;
    this.lastThresholdCheckAt = now;
    void this.autoCancelUnderEnrolledSchedules().catch((err) =>
      this.logger.error('Background autoCancelUnderEnrolledSchedules error:', err),
    );
    void this.autoCancelUnsubstitutedEmergencySchedules().catch((err) =>
      this.logger.error('Background autoCancelUnsubstitutedEmergencySchedules error:', err),
    );
  }

  /**
   * Tự động đóng ca học nếu trước giờ học 30 phút không có HLV nào nhận dạy thay:
   * - Đóng ca (status = CANCELLED_BY_COACH)
   * - Clear các request liên quan đến dạy thay ca này (status = APPROVED, substitutionStatus = EXPIRED)
   * - Hoàn lại 100% token lượt tập cho học viên
   * - Gửi email xin lỗi & thông báo in-app đến học viên và HLV
   */
  async autoCancelUnsubstitutedEmergencySchedules() {
    try {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      const formatHnTime = (d: Date) =>
        new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        }).format(d);

    // 1. Kiểm tra Lớp nhóm (Group Class Schedules)
    const emergencySchedules = await this.prisma.schedule.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        startTime: {
          gt: now,
          lte: thirtyMinutesFromNow,
        },
        cancellationRequests: {
          some: {
            status: { in: ['PENDING', 'APPROVED'] },
            substitutionStatus: { not: 'ACCEPTED' },
          },
        },
      },
      include: {
        class: { include: { discipline: true } },
        room: true,
        coach: {
          select: {
            id: true,
            fullName: true,
            email: true,
            coachProfile: { select: { bio: true } },
          },
        },
        bookings: {
          where: { status: { in: ['CONFIRMED', 'PENDING'] } },
          include: {
            member: { select: { id: true, fullName: true, email: true } },
            subscription: true,
          },
        },
        cancellationRequests: {
          where: {
            substitutionStatus: { not: 'ACCEPTED' },
          },
        },
      },
    });

    let autoCancelledCount = 0;

    for (const schedule of emergencySchedules) {
      try {
        autoCancelledCount++;
        await this.transactions.run(async (tx) => {
          // A. Đóng ca học
          await tx.schedule.update({
            where: { id: schedule.id },
            data: {
              status: 'CANCELLED_BY_COACH',
              currentEnrolled: 0,
            },
          });

          // B. Clear các request liên quan đến dạy thay ca này
          await tx.cancellationRequest.updateMany({
            where: { scheduleId: schedule.id },
            data: {
              status: 'APPROVED',
              substitutionStatus: 'EXPIRED',
              internalNote:
                'Ca học tự động hủy trước 30 phút do không có HLV nhận dạy thay. Đã hoàn 100% lượt tập cho học viên.',
              reviewedAt: now,
            },
          });

          // C. Hủy đặt chỗ & Hoàn 100% lượt tập cho từng học viên
          for (const booking of schedule.bookings) {
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CANCELLED',
                cancelledAt: now,
                cancelledBy: 'SYSTEM',
                isEmergencyCancellation: true,
                cancellationReason:
                  'Ca học tự động hủy: HLV xin nghỉ và không có HLV nhận dạy thay trước giờ học 30 phút (Hệ thống đã hoàn lại 100% lượt tập)',
              },
            });

            if (booking.subscriptionId) {
              await tx.userSubscription.update({
                where: { id: booking.subscriptionId },
                data: {
                  remainingGroupSessions: { increment: 1 },
                  remainingSessions: { increment: 1 },
                },
              });
            }

            await tx.equipmentReservation.deleteMany({
              where: { bookingId: booking.id },
            });
          }

          // D. Ghi Audit Log
          await tx.auditLog.create({
            data: {
              action: 'AUTO_CANCEL_UNSUBSTITUTED_EMERGENCY_SCHEDULE',
              targetEntity: 'schedules',
              targetId: schedule.id,
              afterState: {
                reason:
                  'HLV xin nghỉ và không có ai nhận dạy thay trước giờ học 30 phút',
                startTime: schedule.startTime,
                affectedBookingsCount: schedule.bookings.length,
              },
            },
          });
        });
      } catch (err) {
        this.logger.error(
          `Failed to auto-cancel unsubstituted emergency schedule ${schedule.id}: ${(err as any)?.message || err}`,
        );
        continue;
      }

      // E. Gửi thông báo SSE & Email
      const startTimeStr = formatHnTime(schedule.startTime);
      const endTimeStr = formatHnTime(schedule.endTime);

      const memberIds = schedule.bookings.map((b) => b.memberId);
      const userIds = [schedule.coachId, ...memberIds];

      // SSE event schedule.updated
      this.events.publish({
        name: 'schedule.updated',
        userIds,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          scheduleId: schedule.id,
          status: 'CANCELLED_BY_COACH',
          coachMessage: `Lớp ${schedule.class?.name} (${startTimeStr}) đã tự động đóng do chưa có HLV nhận dạy thay trước 30 phút.`,
          memberMessage: `Lớp ${schedule.class?.name} (${startTimeStr}) đã tự động hủy do HLV xin nghỉ và không có người dạy thay trước 30 phút. 100% lượt tập đã được hoàn lại.`,
          message: `Lớp ${schedule.class?.name} (${startTimeStr}) đã tự động hủy do HLV xin nghỉ và không có HLV nhận dạy thay trước 30 phút. 100% lượt tập đã được hoàn lại vào tài khoản của bạn.`,
        },
      });

      // SSE event session.cancelled gửi cho Member
      if (memberIds.length > 0) {
        this.events.publish({
          name: 'session.cancelled',
          userIds: memberIds,
          data: {
            scheduleId: schedule.id,
            className: schedule.class?.name,
            startTime: startTimeStr,
            message: `Lớp ${schedule.class?.name} (${startTimeStr}) đã bị hủy do HLV xin nghỉ và không có người dạy thay trước 30 phút. Hệ thống đã tự động hoàn lại 100% lượt tập của bạn.`,
          },
        });
      }

      // Gửi Email xin lỗi chính thức đến từng học viên
      for (const booking of schedule.bookings) {
        if (booking.member?.email) {
          void this.email.sendClassCancelledApologyMemberEmail(
            booking.member.email,
            booking.member.fullName || 'Hội viên',
            {
              className: schedule.class?.name || 'Lớp nhóm',
              startTime: startTimeStr,
              endTime: endTimeStr,
              roomName: schedule.room?.name,
              coachName: schedule.coach?.fullName || 'HLV',
              reason:
                'HLV xin nghỉ đột xuất và không có HLV nhận dạy thay trước giờ học 30 phút (Hệ thống đã tự động hoàn lại 100% lượt tập cho bạn)',
            },
          );
        }
      }

      // Gửi Email thông báo cho HLV xin nghỉ
      const coachBio = schedule.coach?.coachProfile?.bio || '';
      const coachPersonalEmail = coachBio.match(/Email cá nhân:\s*([^\s]+)/i)?.[1];
      const coachEmail = coachPersonalEmail || schedule.coach?.email;
      if (coachEmail) {
        void this.email.sendClassManagerOverrideEmail(
          coachEmail,
          schedule.coach?.fullName || 'HLV',
          {
            className: schedule.class?.name || 'Lớp nhóm',
            startTime: startTimeStr,
            endTime: endTimeStr,
            roomName: schedule.room?.name,
            action: 'FORCE_CLOSE',
            reason:
              'Ca học của bạn đã tự động đóng do đến mốc 30 phút trước giờ học chưa có HLV nào nhận dạy thay. Học viên đã được hoàn lại 100% token.',
          },
        );
      }

      this.logger.log(
        `[AUTO-CANCEL-EMERGENCY] Schedule ${schedule.id} (${schedule.class?.name}) at ${schedule.startTime} auto-cancelled: no substitute before 30m. Refunded ${schedule.bookings.length} bookings.`,
      );
    }

    // 2. Kiểm tra Ca PT 1-1 có yêu cầu xin nghỉ khẩn cấp chưa duyệt / đang chờ tìm người thay
    const emergencyPtRequests = await this.prisma.cancellationRequest.findMany({
      where: {
        bookingId: { not: null },
        status: { in: ['PENDING', 'APPROVED'] },
        substitutionStatus: { not: 'ACCEPTED' },
        booking: {
          status: 'CONFIRMED',
          coachAvailability: {
            startTime: {
              gt: now,
              lte: thirtyMinutesFromNow,
            },
          },
        },
      },
      include: {
        booking: {
          include: {
            member: { select: { id: true, fullName: true, email: true } },
            coachAvailability: true,
            subscription: true,
          },
        },
        coach: { select: { id: true, fullName: true, email: true } },
      },
    });

    for (const req of emergencyPtRequests) {
      if (!req.booking) continue;
      try {
        await this.transactions.run(async (tx) => {
          await tx.booking.update({
            where: { id: req.booking!.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancelledBy: 'SYSTEM',
              isEmergencyCancellation: true,
              cancellationReason:
                'Ca PT 1-1 hủy tự động: HLV xin nghỉ đột xuất trước giờ tập 30 phút (Đã hoàn lại 100% token)',
            },
          });

          if (req.booking!.subscriptionId) {
            await tx.userSubscription.update({
              where: { id: req.booking!.subscriptionId },
              data: {
                remainingPtSessions: { increment: 1 },
                remainingSessions: { increment: 1 },
              },
            });
          }

          if (req.booking!.coachAvailabilityId) {
            await tx.coachAvailability.update({
              where: { id: req.booking!.coachAvailabilityId },
              data: { isEmergencyCancelled: true },
            });
          }

          await tx.cancellationRequest.update({
            where: { id: req.id },
            data: {
              status: 'APPROVED',
              substitutionStatus: 'EXPIRED',
              internalNote:
                'Ca PT tự động hủy do sát giờ (< 30 phút). Đã hoàn 100% token cho học viên.',
              reviewedAt: now,
            },
          });
        });

        // Gửi thông báo & email cho học viên PT
        if (req.booking.member?.email) {
          const sTime = req.booking.coachAvailability?.startTime
            ? formatHnTime(req.booking.coachAvailability.startTime)
            : 'Sắp tới';
          void this.email.sendClassCancelledApologyMemberEmail(
            req.booking.member.email,
            req.booking.member.fullName || 'Hội viên',
            {
              className: 'Buổi tập kèm riêng (PT 1-1)',
              startTime: sTime,
              endTime: req.booking.coachAvailability?.endTime
                ? formatHnTime(req.booking.coachAvailability.endTime)
                : '',
              coachName: req.coach?.fullName || 'HLV',
              reason: req.reasonMessage,
            },
          );
        }

        this.events.publish({
          name: 'session.cancelled',
          userIds: [req.booking.memberId],
          roles: ['MEMBER'],
          data: {
            bookingId: req.booking.id,
            message: `Buổi tập PT 1-1 đã bị hủy do HLV xin nghỉ đột xuất. Lượt tập đã được hoàn trả 100% vào tài khoản của bạn.`,
          },
        });
      } catch (ptErr) {
        this.logger.error(
          `Failed to auto-cancel PT request ${req.id}: ${(ptErr as any)?.message || ptErr}`,
        );
      }
    }

    return {
      checkedSchedules: emergencySchedules.length,
      cancelledSchedules: autoCancelledCount,
      cancelledPtRequests: emergencyPtRequests.length,
    };
    } catch (err) {
      this.logger.error('Error during autoCancelUnsubstitutedEmergencySchedules:', err);
      return { checkedSchedules: 0, cancelledSchedules: 0, cancelledPtRequests: 0 };
    }
  }

  async autoCancelUnderEnrolledSchedules() {
    try {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcoming = await this.prisma.schedule.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        startTime: {
          gt: now,
          lte: twoDaysFromNow,
        },
      },
      include: {
        class: { include: { discipline: true } },
        room: true,
        coach: {
          select: {
            id: true,
            fullName: true,
            email: true,
            coachProfile: { select: { bio: true } },
          },
        },
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            member: { select: { id: true, fullName: true, email: true } },
            subscription: true,
          },
        },
      },
    });

    let cancelledCount = 0;

    for (const schedule of upcoming) {
      const capacity = schedule.capacity || schedule.room?.capacity || 5;
      const minRequired = Math.ceil(capacity * 0.6); // Ngưỡng 60% sĩ số (ví dụ phòng 5 người cần tối thiểu 3 người)
      const confirmedCount = schedule.bookings.length;

      // Check if Manager has explicitly overridden this schedule to stay open
      const managerOverride = await this.prisma.auditLog.findFirst({
        where: {
          targetEntity: 'schedules',
          targetId: schedule.id,
          action: 'MANAGER_OVERRIDE_OPEN_SCHEDULE',
        },
      });

      if (managerOverride) {
        // Manager allowed this schedule to stay open as an exception
        continue;
      }

      if (confirmedCount < minRequired) {
        try {
          cancelledCount++;
          await this.transactions.run(async (tx) => {
            // 1. Update schedule status
            await tx.schedule.update({
              where: { id: schedule.id },
              data: {
                status: 'CANCELLED_BY_COACH',
                currentEnrolled: 0,
              },
            });

            // 2. Cancel bookings and refund tokens to each member
            for (const booking of schedule.bookings) {
              await tx.booking.update({
                where: { id: booking.id },
                data: {
                  status: 'CANCELLED',
                  cancelledAt: now,
                  cancelledBy: 'SYSTEM',
                  cancellationReason:
                    'Lớp nhóm hủy tự động: Không đủ 60% sĩ số đăng ký tối thiểu trước 2 ngày (Đã hoàn lại lượt tập)',
                },
              });

              // Refund token to member's subscription
              if (booking.subscriptionId) {
                await tx.userSubscription.update({
                  where: { id: booking.subscriptionId },
                  data: {
                    remainingGroupSessions: { increment: 1 },
                    remainingSessions: { increment: 1 },
                  },
                });
              }

              // Clean equipment reservation if any
              await tx.equipmentReservation.deleteMany({
                where: { bookingId: booking.id },
              });
            }

            // 3. Record Audit Log
            await tx.auditLog.create({
              data: {
                action: 'AUTO_CANCEL_SCHEDULE_LOW_ATTENDANCE',
                targetEntity: 'schedules',
                targetId: schedule.id,
                afterState: {
                  reason: 'Không đủ 60% sĩ số đăng ký tối thiểu trước 2 ngày',
                  enrolledCount: confirmedCount,
                  capacity,
                  minRequired,
                  startTime: schedule.startTime,
                },
              },
            });
          });
        } catch (scheduleCancelError) {
          this.logger.error(
            `Failed to auto-cancel under-enrolled schedule ${schedule.id}: ${(scheduleCancelError as any)?.message || scheduleCancelError}`,
          );
          continue;
        }

        // 4. Send Notifications (SSE + Email)
        const formatHnTime = (d: Date) => {
          return new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(d);
        };

        const startTimeStr = formatHnTime(schedule.startTime);
        const endTimeStr = formatHnTime(schedule.endTime);

        // Notify each member
        for (const booking of schedule.bookings) {
          this.events.publish({
            name: 'class.auto_cancelled',
            userIds: [booking.memberId],
            roles: ['MEMBER'],
            data: {
              scheduleId: schedule.id,
              className: schedule.class?.name,
              startTime: schedule.startTime,
              refunded: true,
              message: `Lớp ${schedule.class?.name} lúc ${startTimeStr} đã bị hủy do không đủ 60% sĩ số tối thiểu. 1 lượt tập (token) đã được hoàn trả lại cho bạn.`,
            },
          });

          if (booking.member?.email) {
            void this.email.sendClassAutoCancelledMemberEmail(
              booking.member.email,
              booking.member.fullName || 'Hội viên',
              {
                className: schedule.class?.name || 'Lớp nhóm',
                startTime: startTimeStr,
                endTime: endTimeStr,
                roomName: schedule.room?.name,
                coachName: schedule.coach?.fullName,
              },
            );
          }
        }

        // Notify coach via SSE (Coach nhận thông báo trực tiếp trên Web và Mobile App)
        this.events.publish({
          name: 'class.auto_cancelled',
          userIds: [schedule.coachId],
          roles: ['COACH'],
          data: {
            scheduleId: schedule.id,
            className: schedule.class?.name,
            startTime: schedule.startTime,
            message: `Lớp ${schedule.class?.name} lúc ${startTimeStr} đã tự động hủy do không đủ 60% sĩ số trước 2 ngày. Bạn không bị kỷ luật.`,
          },
        });

        this.logger.log(
          `[AUTO-CANCEL] Cancelled schedule ${schedule.id} (${schedule.class?.name}) at ${schedule.startTime} - Enrolled: ${confirmedCount}/${capacity} (Min required: ${minRequired})`,
        );
      }
    }

    return { checked: upcoming.length, cancelled: cancelledCount };
    } catch (err) {
      this.logger.error('Error during autoCancelUnderEnrolledSchedules:', err);
      return { checked: 0, cancelled: 0 };
    }
  }

  async list(query?: ScheduleQueryDto) {
    // Non-blocking threshold check throttled to once per 60s so schedule reads stay instant
    this.triggerStaleThresholdChecks();

    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);
    const now = new Date();
    const effectiveStart = startUtc && startUtc > now ? startUtc : now;
    const items = await this.prisma.schedule.findMany({
      where: {
        status: { in: ['OPEN', 'FULL', 'CANCELLED_BY_COACH'] },
        startTime: {
          gt: effectiveStart,
          ...(endUtc ? { lte: endUtc } : {}),
        },
        ...(query?.coachId ? { coachId: query.coachId } : {}),
        ...(query?.classId ? { classId: query.classId } : {}),
        ...(query?.disciplineId
          ? { class: { disciplineId: query.disciplineId } }
          : {}),
      },
      include: {
        class: { include: { discipline: true } },
        room: true,
        coach: { select: { id: true, fullName: true } },
      },
      orderBy: { startTime: 'asc' },
      take: startUtc || endUtc ? undefined : 200,
    });

    const scheduleIds = items.map((i) => i.id);
    const overrides = await this.prisma.auditLog.findMany({
      where: {
        targetEntity: 'schedules',
        targetId: { in: scheduleIds },
        action: {
          in: [
            'MANAGER_OVERRIDE_OPEN_SCHEDULE',
            'MANAGER_OVERRIDE_CLOSE_SCHEDULE',
            'AUTO_CANCEL_SCHEDULE_LOW_ATTENDANCE',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const overrideMap = new Map<string, any>();
    for (const ov of overrides) {
      if (!overrideMap.has(ov.targetId!)) {
        overrideMap.set(ov.targetId!, ov);
      }
    }

    return items.map((item) => {
      const lastAudit = overrideMap.get(item.id);
      const isManagerOverrideOpen = lastAudit?.action === 'MANAGER_OVERRIDE_OPEN_SCHEDULE';
      const isAutoCancelled = lastAudit?.action === 'AUTO_CANCEL_SCHEDULE_LOW_ATTENDANCE';
      const capacity = item.room?.capacity
        ? Math.min(item.capacity || 5, item.room.capacity)
        : (item.capacity || 5);
      const minRequired = Math.ceil(capacity * 0.6);
      return {
        ...item,
        capacity,
        minRequired,
        isManagerOverride: isManagerOverrideOpen,
        isAutoCancelled,
        overrideNote: (lastAudit?.afterState as any)?.reason,
      };
    });
  }

  async managerBoard(query?: ScheduleQueryDto) {
    const baseSchedules = await this.list(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);
    const now = new Date();
    const effectiveStart = startUtc && startUtc > now ? startUtc : now;

    const bookedSlots = await this.prisma.coachAvailability.findMany({
      where: {
        isBooked: true,
        startTime: {
          gt: effectiveStart,
          ...(endUtc ? { lte: endUtc } : {}),
        },
        ...(query?.coachId ? { coachId: query.coachId } : {}),
        bookings: {
          some: {
            status: 'CONFIRMED',
            ...(query?.disciplineId ? { disciplineId: query.disciplineId } : {}),
          },
        },
      },
      include: {
        coach: { select: { id: true, fullName: true } },
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            discipline: true,
            member: { select: { id: true, fullName: true } },
            subscription: {
              include: {
                plan: {
                  include: {
                    discipline: true,
                    room: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 200,
    });

    const mappedSlots = bookedSlots
      .filter((slot) => slot.bookings.length > 0)
      .map((slot) => {
        const firstBooking = slot.bookings[0];
        const isGroup = firstBooking.bookingType === 'GROUP_CLASS';
        const disc =
          firstBooking.discipline ?? firstBooking.subscription?.plan?.discipline ?? null;
        const planName = firstBooking.subscription?.plan?.name;
        const planRoom = firstBooking.subscription?.plan?.room;
        const memberNames = slot.bookings
          .map((b) => b.member?.fullName || b.member_name)
          .filter(Boolean)
          .join(', ');

        return {
          id: slot.id,
          isSlotBooking: true,
          bookingType: firstBooking.bookingType,
          memberNames,
          classId: firstBooking.subscription?.planId ?? slot.id,
          roomId: planRoom?.id ?? '',
          coachId: slot.coachId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: isGroup ? 5 : 1,
          currentEnrolled: slot.bookings.length,
          status: slot.isEmergencyCancelled ? 'CANCELLED_BY_COACH' : 'OPEN',
          class: {
            id: firstBooking.subscription?.planId ?? slot.id,
            name:
              planName ||
              (isGroup
                ? `Lớp nhóm ${disc?.name || ''}`.trim()
                : `PT 1-1 • ${memberNames || 'Học viên'}`),
            disciplineId: disc?.id ?? firstBooking.disciplineId ?? undefined,
            discipline: disc,
          },
          room: planRoom ?? {
            id: '',
            name: isGroup ? 'Phòng chuyên đề (Khung giờ HLV)' : 'Khu vực PT 1-1',
          },
          coach: slot.coach ?? {
            id: slot.coachId,
            fullName: slot.coach_name || 'HLV',
          },
        };
      });

    return [...baseSchedules, ...mappedSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
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
    if (!dto.roomId) {
      // 1. First prioritize dedicated room configured on the matching membership plan
      const plansForDiscipline = await tx.membershipPlan.findMany({
        where: {
          disciplineId: cls.disciplineId,
          isActive: true,
          roomId: { not: null },
        },
      });
      const matchingPlan = plansForDiscipline.find((p) => {
        const comp = isClassCompatibleWithPlan(cls.name, p.name, cls.discipline.code);
        return comp.isCompatible && p.roomId;
      });

      if (matchingPlan?.roomId) {
        dto.roomId = matchingPlan.roomId;
      } else {
        const dedicatedRoomName = getSpecialtyDedicatedRoomName(cls.name, cls.discipline.code);
        const autoRoom = await tx.room.findFirst({
          where: { name: dedicatedRoomName, isActive: true },
        });
        if (autoRoom) dto.roomId = autoRoom.id;
      }
    }
    const room = requireRecord(
      await tx.room.findUnique({ where: { id: dto.roomId } }),
    );
    requireCondition(room.isActive, 'ROOM_INACTIVE');
    requireCondition(dto.capacity <= room.capacity, 'INVALID_ROOM_CAPACITY');

    // 1. Kiểm tra phòng tập: Mỗi phòng tập có 5 khu vực tương ứng với 5 cấp độ sao (1 đến 5 sao).
    // Nếu trong khung giờ này đã có HLV cùng cấp sao xếp lịch cho phòng, thì chặn (Khu vực đó đã bị chiếm).
    // Nếu HLV khác cấp sao (ví dụ 3 sao vs 2 sao), cho phép xếp lịch song song trong các khu vực khác nhau của phòng (tối đa 5 khu vực).
    const currentCoachProfile = await tx.coachProfile.findUnique({
      where: { userId: dto.coachId },
      select: { ratingStars: true },
    });
    const currentCoachStars = currentCoachProfile?.ratingStars ?? 3;

    const overlappingSameStar = await tx.schedule.findFirst({
      where: {
        roomId: dto.roomId,
        startTime: { lt: end },
        endTime: { gt: start },
        status: { in: ['OPEN', 'FULL'] },
        coach: {
          coachProfile: {
            ratingStars: currentCoachStars,
          },
        },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      include: { class: true, coach: true, room: true },
    });
    if (overlappingSameStar) {
      throw new BadRequestException(
        `Khu vực ${currentCoachStars} sao của phòng "${overlappingSameStar.room?.name || 'này'}" trong khung giờ này đã có HLV ${overlappingSameStar.coach?.fullName || ''} (${currentCoachStars} sao) xếp lịch cho lớp "${overlappingSameStar.class?.name || ''}". Mỗi phòng gồm 5 khu vực (1-5 sao), mỗi cấp sao chỉ tối đa 1 HLV tiếp quản trong cùng khung giờ!`,
      );
    }

    const roomSchedulesCount = await tx.schedule.count({
      where: {
        roomId: dto.roomId,
        startTime: { lt: end },
        endTime: { gt: start },
        status: { in: ['OPEN', 'FULL'] },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
    });
    if (roomSchedulesCount >= 5) {
      throw new BadRequestException(
        `Phòng "${room.name}" đã kín cả 5 khu vực (từ 1 đến 5 sao) trong khung giờ này!`,
      );
    }

    // 2. Kiểm tra HLV này đã có lịch dạy lớp khác trong khung giờ này chưa
    const overlappingCoachSchedule = await tx.schedule.findFirst({
      where: {
        coachId: dto.coachId,
        startTime: { lt: end },
        endTime: { gt: start },
        status: { in: ['OPEN', 'FULL'] },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      include: { class: true },
    });
    if (overlappingCoachSchedule) {
      throw new BadRequestException(
        `HLV đã có lịch dạy lớp "${overlappingCoachSchedule.class?.name}" trùng vào khung giờ này!`,
      );
    }

    // 3. Kiểm tra HLV có mở ca rảnh/dạy PT kèm riêng trùng khung giờ này không
    const overlappingCoachPt = await tx.coachAvailability.findFirst({
      where: {
        coachId: dto.coachId,
        startTime: { lt: end },
        endTime: { gt: start },
        isEmergencyCancelled: false,
      },
    });
    if (overlappingCoachPt) {
      throw new BadRequestException(
        `HLV đã mở ca rảnh/dạy PT kèm riêng trong khung giờ này! Không thể xếp lịch trùng.`,
      );
    }

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

    // 4. Siết chặt chuyên đề của khóa học: HLV phải có chứng chỉ/chuyên môn cho lớp này
    const classSpec = getClassSpecialtyCode(cls.name, cls.discipline.code);
    if (classSpec) {
      const hasSpec = await tx.coachSpecialty.findFirst({
        where: {
          coachProfile: { userId: dto.coachId },
          specialty: { code: classSpec },
        },
      });
      if (!hasSpec) {
        throw new BadRequestException(
          `HLV chưa có chứng chỉ/chuyên môn cho chuyên đề "${SPECIALTY_NAME_MAP[classSpec] || classSpec}".`,
        );
      }
    }
    const coachProfileForDuty = await tx.coachProfile.findUnique({
      where: { userId: dto.coachId },
      select: { workingDays: true, workingHours: true },
    });
    const inProfileHours = isWithinCoachProfileSchedule(
      coachProfileForDuty,
      start,
      end,
    );
    const shift = inProfileHours
      ? true
      : await tx.staffShift.findFirst({
          where: {
            staffId: dto.coachId,
            startTime: { lte: start },
            endTime: { gte: end },
          },
        });
    requireCondition(inProfileHours || Boolean(shift), 'COACH_NOT_ON_DUTY_SHIFT');
    const { startUtc: dayStart, endUtc: dayEnd } = getVietnamDayBounds(start);
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
      this.events.publish({
        name: 'schedule.assigned',
        userIds: [value.coachId],
        roles: ['CENTER_MANAGER', 'COACH'],
        data: {
          scheduleId: value.id,
          coachId: value.coachId,
          startTime: value.startTime,
          endTime: value.endTime,
        },
      });
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
      this.events.publish({
        name: 'schedule.assigned',
        userIds: [value.coachId],
        roles: ['CENTER_MANAGER', 'COACH'],
        data: {
          scheduleId: value.id,
          coachId: value.coachId,
          startTime: value.startTime,
          endTime: value.endTime,
        },
      });
      return value;
    });
  }
  delete(id: string, actor: Actor) {
    return this.transactions.run(async (tx) => {
      const schedule = requireRecord(
        await tx.schedule.findUnique({
          where: { id },
          include: {
            class: { include: { discipline: true } },
            room: true,
            coach: { include: { coachProfile: true } },
            bookings: {
              include: {
                member: true,
                subscription: true,
              },
            },
          },
        }),
      );

      const now = new Date();
      // Quản lý có quyền hủy/xóa lịch bất kể bao nhiêu thành viên đã đăng ký.
      // Tự động hủy bookings, hoàn trả 100% lượt tập cho từng học viên.
      for (const booking of schedule.bookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledBy: 'MANAGER',
            cancellationReason: 'Quản lý hủy ca lớp học (Đã hoàn lại 100% lượt tập)',
          },
        });

        if (booking.subscriptionId) {
          await tx.userSubscription.update({
            where: { id: booking.subscriptionId },
            data: {
              remainingGroupSessions: { increment: 1 },
              remainingSessions: { increment: 1 },
            },
          });
        }

        await tx.equipmentReservation.deleteMany({
          where: { bookingId: booking.id },
        });
      }

      await tx.cancellationRequest.deleteMany({ where: { scheduleId: id } });
      await tx.booking.deleteMany({ where: { scheduleId: id } });
      await tx.schedule.delete({ where: { id } });
      await audit(tx, actor, 'DELETE_SCHEDULE', 'schedules', id, {
        hadBookingsCount: schedule.bookings.length,
      });

      // Gửi thông báo SSE & Email cho học viên và HLV nếu có
      const startTimeStr = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(schedule.startTime);

      const endTimeStr = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(schedule.endTime);

      const userIds = [schedule.coachId, ...schedule.bookings.map((b) => b.memberId)];
      this.events.publish({
        name: 'schedule.updated',
        userIds,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          scheduleId: schedule.id,
          status: 'CANCELLED_BY_COACH',
          coachMessage: `Quản lý đã hủy lịch lớp ${schedule.class.name} (${startTimeStr}). Bạn không bị tính vi phạm.`,
          memberMessage: `Quản lý đã hủy lịch lớp ${schedule.class.name} (${startTimeStr}). 100% lượt tập đã được hoàn trả cho bạn.`,
          message: `Quản lý đã hủy lịch lớp ${schedule.class.name} (${startTimeStr}). Lượt tập đã được hoàn trả 100% cho học viên.`,
        },
      });

      // Gửi email xin lỗi & hoàn token cho từng học viên
      for (const booking of schedule.bookings) {
        if (booking.member?.email) {
          void this.email.sendClassCancelledApologyMemberEmail(
            booking.member.email,
            booking.member.fullName || 'Hội viên',
            {
              className: schedule.class.name,
              startTime: startTimeStr,
              endTime: endTimeStr,
              roomName: schedule.room?.name,
              reason: 'Quản lý hủy ca lớp học (Hệ thống đã tự động hoàn lại 100% lượt tập của bạn)',
            },
          );
        }
      }

      // Gửi email thông báo cho HLV
      const coachBio = schedule.coach?.coachProfile?.bio || '';
      const coachPersonalEmail = coachBio.match(/Email cá nhân:\s*([^\s]+)/i)?.[1];
      const coachEmail = coachPersonalEmail || schedule.coach?.email;
      if (coachEmail) {
        void this.email.sendClassManagerOverrideEmail(
          coachEmail,
          schedule.coach?.fullName || 'HLV',
          {
            className: schedule.class.name,
            startTime: startTimeStr,
            endTime: endTimeStr,
            roomName: schedule.room?.name,
            action: 'FORCE_CLOSE',
            reason: 'Quản lý đã xóa/hủy ca học này.',
          },
        );
      }

      return { id };
    });
  }

  async eligibleCoaches(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        class: { include: { discipline: true } },
        coach: { include: { coachProfile: true } },
      },
    });
    if (!schedule) return [];

    const targetStars = schedule.coach?.coachProfile?.ratingStars;
    const classSpec = getClassSpecialtyCode(
      schedule.class?.name || '',
      schedule.class?.discipline?.code,
    );

    const specialties = await this.prisma.coachSpecialty.findMany({
      where: classSpec
        ? { specialty: { code: classSpec } }
        : { specialty: { disciplineId: schedule.class.disciplineId } },
      include: {
        coachProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    const candidateMap = new Map<string, any>();
    for (const s of specialties) {
      const u = s.coachProfile?.user;
      if (u && u.isActive && u.id !== schedule.coachId) {
        if (targetStars !== undefined && targetStars !== null) {
          if (s.coachProfile?.ratingStars === targetStars) {
            candidateMap.set(u.id, { user: u, profile: s.coachProfile });
          }
        } else {
          candidateMap.set(u.id, { user: u, profile: s.coachProfile });
        }
      }
    }

    const availableCoaches = [];
    for (const { user: coach, profile } of candidateMap.values()) {
      const inProfileHours = isWithinCoachProfileSchedule(
        profile,
        schedule.startTime,
        schedule.endTime,
      );
      if (!inProfileHours) {
        const shift = await this.prisma.staffShift.findFirst({
          where: {
            staffId: coach.id,
            startTime: { lte: schedule.startTime },
            endTime: { gte: schedule.endTime },
          },
          select: { id: true },
        });
        if (!shift) continue;
      }

      const [conflictSchedule, conflictSlot] = await Promise.all([
        this.prisma.schedule.findFirst({
          where: {
            coachId: coach.id,
            status: { in: ['OPEN', 'FULL'] },
            startTime: { lt: schedule.endTime },
            endTime: { gt: schedule.startTime },
          },
          select: { id: true },
        }),
        this.prisma.coachAvailability.findFirst({
          where: {
            coachId: coach.id,
            isBooked: true,
            isEmergencyCancelled: false,
            startTime: { lt: schedule.endTime },
            endTime: { gt: schedule.startTime },
          },
          select: { id: true },
        }),
      ]);
      if (!conflictSchedule && !conflictSlot) {
        availableCoaches.push(coach);
      }
    }

    return availableCoaches;
  }

  async managerOverride(
    scheduleId: string,
    dto: ManagerScheduleOverrideDto,
    actor: Actor,
  ) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        class: true,
        room: true,
        coach: {
          select: {
            id: true,
            fullName: true,
            email: true,
            coachProfile: { select: { bio: true } },
          },
        },
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            member: { select: { id: true, fullName: true, email: true } },
            subscription: true,
          },
        },
      },
    });

    if (!schedule) {
      if (dto.action === 'FORCE_CLOSE') {
        const slot = await this.prisma.coachAvailability.findUnique({
          where: { id: scheduleId },
          include: {
            coach: { select: { id: true, fullName: true, email: true } },
            bookings: {
              where: { status: 'CONFIRMED' },
              include: {
                member: { select: { id: true, fullName: true, email: true } },
                discipline: true,
                subscription: { include: { plan: { include: { room: true } } } },
              },
            },
          },
        });
        if (slot) {
          const now = new Date();
          const formatHnTime = (d: Date) =>
            new Intl.DateTimeFormat('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'Asia/Ho_Chi_Minh',
            }).format(d);
          const startTimeStr = formatHnTime(slot.startTime);
          const endTimeStr = formatHnTime(slot.endTime);

          await this.transactions.run(async (tx) => {
            await tx.coachAvailability.update({
              where: { id: slot.id },
              data: { isEmergencyCancelled: true },
            });

            for (const booking of slot.bookings) {
              await tx.booking.update({
                where: { id: booking.id },
                data: {
                  status: 'CANCELLED',
                  cancelledAt: now,
                  cancelledBy: 'MANAGER',
                  cancellationReason: `Quản lý hủy ca: ${dto.reason} (Đã hoàn lại lượt tập)`,
                },
              });

              if (booking.subscriptionId) {
                const isGroup = booking.bookingType === 'GROUP_CLASS';
                await tx.userSubscription.update({
                  where: { id: booking.subscriptionId },
                  data: isGroup
                    ? {
                        remainingGroupSessions: { increment: 1 },
                        remainingSessions: { increment: 1 },
                      }
                    : {
                        remainingPtSessions: { increment: 1 },
                        remainingSessions: { increment: 1 },
                      },
                });
              }

              await tx.equipmentReservation.deleteMany({
                where: { bookingId: booking.id },
              });
            }

            await tx.auditLog.create({
              data: {
                userId: actor.userId,
                action: 'MANAGER_OVERRIDE_CLOSE_SCHEDULE',
                targetEntity: 'coach_availabilities',
                targetId: slot.id,
                afterState: {
                  action: 'FORCE_CLOSE',
                  reason: dto.reason,
                  cancelledBookingsCount: slot.bookings.length,
                  performedBy: actor.userId,
                },
              },
            });
          });

          const firstBooking = slot.bookings[0];
          const className =
            firstBooking?.subscription?.plan?.name ||
            (firstBooking?.bookingType === 'GROUP_CLASS'
              ? `Lớp nhóm ${firstBooking?.discipline?.name || ''}`.trim()
              : 'Ca tập PT 1-1');
          const roomName = firstBooking?.subscription?.plan?.room?.name;

          this.events.publish({
            name: 'schedule.updated',
            userIds: [slot.coachId, ...slot.bookings.map((b) => b.memberId)],
            roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
            data: {
              scheduleId: slot.id,
              status: 'CANCELLED_BY_COACH',
              coachMessage: `Quản lý đã đóng/hủy ca ${className} (${startTimeStr}). Lý do: ${dto.reason}. Bạn không bị kỷ luật.`,
              memberMessage: `Quản lý đã hủy ca ${className} (${startTimeStr}). Lý do: ${dto.reason}. 100% lượt tập đã được hoàn trả.`,
              message: `Quản lý đã hủy ca ${className} (${startTimeStr}). Lý do: ${dto.reason}. Lượt tập đã được hoàn trả.`,
            },
          });

          for (const booking of slot.bookings) {
            if (booking.member?.email) {
              void this.email.sendClassManagerOverrideEmail(
                booking.member.email,
                booking.member.fullName || 'Hội viên',
                {
                  className,
                  startTime: startTimeStr,
                  endTime: endTimeStr,
                  roomName,
                  action: 'FORCE_CLOSE',
                  reason: dto.reason,
                },
              );
            }
          }

          return {
            success: true,
            message:
              'Đã hủy ca, hoàn trả lượt tập cho học viên và gửi email thông báo.',
          };
        }
      }
      throw new NotFoundException('Không tìm thấy lịch lớp học');
    }

    const now = new Date();
    const formatHnTime = (d: Date) => {
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(d);
    };
    const startTimeStr = formatHnTime(schedule.startTime);
    const endTimeStr = formatHnTime(schedule.endTime);

    if (dto.action === 'FORCE_OPEN') {
      // Nghiệp vụ: chỉ cho phép mở lớp ngoại lệ nếu người tham gia lớn hơn 0
      if (schedule.currentEnrolled <= 0 && schedule.bookings.length === 0) {
        throw new BadRequestException(
          'Không thể mở lớp ngoại lệ khi chưa có học viên nào đăng ký (sĩ số hiện tại phải lớn hơn 0).',
        );
      }

      await this.transactions.run(async (tx) => {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: {
            status: schedule.currentEnrolled >= schedule.capacity ? 'FULL' : 'OPEN',
          },
        });

        // Ghi AuditLog
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'MANAGER_OVERRIDE_OPEN_SCHEDULE',
            targetEntity: 'schedules',
            targetId: schedule.id,
            afterState: {
              action: 'FORCE_OPEN',
              reason: dto.reason,
              enrolledCount: schedule.currentEnrolled,
              capacity: schedule.capacity,
              performedBy: actor.userId,
            },
          },
        });
      });

      // Send SSE notification
      const userIds = [schedule.coachId, ...schedule.bookings.map((b) => b.memberId)];
      this.events.publish({
        name: 'schedule.updated',
        userIds,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          scheduleId: schedule.id,
          status: 'OPEN',
          message: `Quản lý đã phê duyệt mở lớp ngoại lệ cho lớp ${schedule.class.name} (${startTimeStr}). Lớp học vẫn diễn ra bình thường.`,
        },
      });

      // Send emails to enrolled members
      for (const booking of schedule.bookings) {
        if (booking.member?.email) {
          void this.email.sendClassManagerOverrideEmail(
            booking.member.email,
            booking.member.fullName || 'Hội viên',
            {
              className: schedule.class.name,
              startTime: startTimeStr,
              endTime: endTimeStr,
              roomName: schedule.room?.name,
              action: 'FORCE_OPEN',
              reason: dto.reason,
            },
          );
        }
      }

      // Send email to Coach
      const coachBio = schedule.coach?.coachProfile?.bio || '';
      const coachPersonalEmail = coachBio.match(/Email cá nhân:\s*([^\s]+)/i)?.[1];
      const coachEmail = coachPersonalEmail || schedule.coach?.email;
      if (coachEmail) {
        void this.email.sendClassManagerOverrideEmail(
          coachEmail,
          schedule.coach?.fullName || 'HLV',
          {
            className: schedule.class.name,
            startTime: startTimeStr,
            endTime: endTimeStr,
            roomName: schedule.room?.name,
            action: 'FORCE_OPEN',
            reason: dto.reason,
          },
        );
      }

      return {
        success: true,
        message: 'Đã mở lớp ngoại lệ thành công và ghi log kiểm toán.',
      };
    } else {
      // FORCE_CLOSE
      await this.transactions.run(async (tx) => {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: {
            status: 'CANCELLED_BY_COACH',
            currentEnrolled: 0,
          },
        });

        // Cancel bookings and refund tokens
        for (const booking of schedule.bookings) {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancelledBy: 'MANAGER',
              cancellationReason: `Quản lý đóng lớp ngoại lệ: ${dto.reason} (Đã hoàn lại lượt tập)`,
            },
          });

          if (booking.subscriptionId) {
            await tx.userSubscription.update({
              where: { id: booking.subscriptionId },
              data: {
                remainingGroupSessions: { increment: 1 },
                remainingSessions: { increment: 1 },
              },
            });
          }

          await tx.equipmentReservation.deleteMany({
            where: { bookingId: booking.id },
          });
        }

        // Ghi AuditLog
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'MANAGER_OVERRIDE_CLOSE_SCHEDULE',
            targetEntity: 'schedules',
            targetId: schedule.id,
            afterState: {
              action: 'FORCE_CLOSE',
              reason: dto.reason,
              cancelledBookingsCount: schedule.bookings.length,
              performedBy: actor.userId,
            },
          },
        });
      });

      // Send SSE notifications
      const userIds = [schedule.coachId, ...schedule.bookings.map((b) => b.memberId)];
      this.events.publish({
        name: 'schedule.updated',
        userIds,
        roles: ['CENTER_MANAGER', 'RECEPTIONIST'],
        data: {
          scheduleId: schedule.id,
          status: 'CANCELLED_BY_COACH',
          coachMessage: `Quản lý đã đóng lớp ngoại lệ ${schedule.class.name} (${startTimeStr}). Lý do: ${dto.reason}. Bạn không bị kỷ luật.`,
          memberMessage: `Quản lý đã đóng lớp ngoại lệ ${schedule.class.name} (${startTimeStr}). Lý do: ${dto.reason}. Lượt tập đã được hoàn trả 100%.`,
          message: `Quản lý đã đóng lớp ngoại lệ cho lớp ${schedule.class.name} (${startTimeStr}). Lý do: ${dto.reason}. Lượt tập đã được hoàn trả.`,
        },
      });

      // Send emails to members
      for (const booking of schedule.bookings) {
        if (booking.member?.email) {
          void this.email.sendClassManagerOverrideEmail(
            booking.member.email,
            booking.member.fullName || 'Hội viên',
            {
              className: schedule.class.name,
              startTime: startTimeStr,
              endTime: endTimeStr,
              roomName: schedule.room?.name,
              action: 'FORCE_CLOSE',
              reason: dto.reason,
            },
          );
        }
      }

      return {
        success: true,
        message: 'Đã đóng lớp ngoại lệ thành công, hoàn trả lượt tập cho học viên và ghi log kiểm toán.',
      };
    }
  }

  async listPeakHours() {
    return this.prisma.peakHourConfig.findMany({
      orderBy: [{ startHour: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async createPeakHour(body: {
    label: string;
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
    dailyCap?: number;
    weeklyCap?: number;
    isActive?: boolean;
  }) {
    const startMins = Number(body.startHour) * 60 + Number(body.startMinute ?? 0);
    const endMins = Number(body.endHour) * 60 + Number(body.endMinute ?? 0);
    if (!body.label?.trim() || endMins <= startMins) {
      throw new BadRequestException('INVALID_PEAK_HOUR_RANGE');
    }
    return this.prisma.peakHourConfig.create({
      data: {
        label: body.label.trim(),
        startHour: Number(body.startHour),
        startMinute: Number(body.startMinute ?? 0),
        endHour: Number(body.endHour),
        endMinute: Number(body.endMinute ?? 0),
        dailyCap: Number(body.dailyCap ?? 2),
        weeklyCap: Number(body.weeklyCap ?? 10),
        isActive: body.isActive ?? true,
      },
    });
  }

  async updatePeakHour(
    id: string,
    body: Partial<{
      label: string;
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
      dailyCap: number;
      weeklyCap: number;
      isActive: boolean;
    }>,
  ) {
    const existing = await this.prisma.peakHourConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PEAK_HOUR_NOT_FOUND');
    const startHour = body.startHour !== undefined ? Number(body.startHour) : existing.startHour;
    const startMinute = body.startMinute !== undefined ? Number(body.startMinute) : existing.startMinute;
    const endHour = body.endHour !== undefined ? Number(body.endHour) : existing.endHour;
    const endMinute = body.endMinute !== undefined ? Number(body.endMinute) : existing.endMinute;
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute) {
      throw new BadRequestException('INVALID_PEAK_HOUR_RANGE');
    }
    return this.prisma.peakHourConfig.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        startHour,
        startMinute,
        endHour,
        endMinute,
        ...(body.dailyCap !== undefined ? { dailyCap: Number(body.dailyCap) } : {}),
        ...(body.weeklyCap !== undefined ? { weeklyCap: Number(body.weeklyCap) } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });
  }

  async deletePeakHour(id: string) {
    await this.prisma.peakHourConfig.delete({ where: { id } });
    return { id };
  }
}
