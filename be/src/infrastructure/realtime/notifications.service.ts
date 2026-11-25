import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainEvent, DomainEvents } from '../../common/events/domain-events';
import type { Actor } from '../../common/types/actor';

export interface InAppNotificationItem {
  id: string;
  eventName: string;
  type: 'checkin' | 'cancellation' | 'payment' | 'booking' | 'locker' | 'system';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  urgent: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

const TRACKED_EVENT_NAMES = new Set([
  'cancellation.requested',
  'cancellation.reviewed',
  'booking.cancelled',
  'session.cancelled',
  'schedule.updated',
  'class.auto_cancelled',
  'substitution.invited',
  'substitution.responded',
  'schedule.assigned',
  'slot.approved',
  'slot.rejected',
]);

function formatHnDateTime(input?: string | Date | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private unsubscribe?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.events.subscribe((event) => {
      if (!TRACKED_EVENT_NAMES.has(event.name)) return;
      if (event.name === 'schedule.updated') {
        const d = (event.data ?? {}) as Record<string, unknown>;
        const isCancel =
          d.status === 'CANCELLED_BY_COACH' ||
          d.status === 'CANCELLED' ||
          Boolean(d.message);
        if (!isCancel) return;
      }
      void this.persistDomainEvent(event);
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  private async persistDomainEvent(event: DomainEvent) {
    try {
      const safeData = JSON.parse(JSON.stringify(event.data ?? {})) as Record<
        string,
        unknown
      >;
      await this.prisma.auditLog.create({
        data: {
          action: 'IN_APP_NOTIFICATION',
          targetEntity: 'notifications',
          afterState: {
            eventName: event.name,
            userIds: event.userIds ?? [],
            roles: event.roles ?? [],
            data: safeData,
            readBy: [],
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist in-app notification for ${event.name}: ${(err as Error)?.message || err}`,
      );
    }
  }

  private linkForRole(role: UserRole, eventName: string): string {
    if (role === UserRole.COACH) {
      if (eventName === 'substitution.invited') {
        return '/portal/coach/requests?tab=INVITATIONS';
      }
      return '/portal/coach/schedule';
    }
    if (role === UserRole.MEMBER) {
      return '/portal/member/bookings';
    }
    if (role === UserRole.CENTER_MANAGER || role === UserRole.ADMIN) {
      if (eventName.startsWith('cancellation') || eventName.startsWith('substitution')) {
        return '/portal/manager/penalties';
      }
      return '/portal/manager/classes';
    }
    return '/portal/desk';
  }

  private formatPersistedEvent(
    row: { id: string; createdAt: Date; afterState: unknown },
    actor: Actor,
  ): { item: InAppNotificationItem; dedupeKey?: string } | null {
    const state = (row.afterState ?? {}) as {
      eventName?: string;
      userIds?: string[];
      roles?: string[];
      data?: Record<string, unknown>;
      readBy?: string[];
    };
    const eventName = state.eventName || 'system';
    const userIds = Array.isArray(state.userIds) ? state.userIds : [];
    const roles = Array.isArray(state.roles) ? state.roles : [];
    const data = (state.data ?? {}) as Record<string, unknown>;

    const matchesUser = userIds.includes(actor.userId);
    const matchesRole = roles.includes(actor.role);
    if (!matchesUser && !matchesRole) return null;

    // Tránh gửi thông báo dành riêng cho Quản lý/Lễ tân ngược lại cho HLV vừa bấm gửi đơn
    if (
      eventName === 'cancellation.requested' &&
      actor.role === UserRole.COACH &&
      data.coachId === actor.userId &&
      !data.requestedByReceptionist
    ) {
      return null;
    }

    const readBy = Array.isArray(state.readBy) ? state.readBy : [];
    const read = readBy.includes(actor.userId);
    const createdAt = row.createdAt.toISOString();
    const link = this.linkForRole(actor.role, eventName);

    let type: InAppNotificationItem['type'] = 'system';
    let title = 'Thông báo hệ thống';
    let message = String(data.message || '');
    let urgent = false;
    let dedupeKey: string | undefined;

    if (eventName === 'cancellation.requested') {
      type = 'cancellation';
      urgent = true;
      const reason = data.reasonMessage ? `: "${String(data.reasonMessage)}"` : '';
      title = 'Yêu cầu hủy ca khẩn cấp';
      message =
        actor.role === UserRole.COACH
          ? `Lễ tân đã gửi yêu cầu nghỉ ca giúp bạn${reason}.`
          : `HLV ${String(data.coachName || '')} vừa gửi yêu cầu hủy ca đột xuất${reason}.`.replace(
              /\s+/g,
              ' ',
            );
      if (data.id) dedupeKey = `cancel-req-${String(data.id)}-PENDING`;
    } else if (eventName === 'cancellation.reviewed') {
      type = 'cancellation';
      const approved = data.status === 'APPROVED';
      urgent = true;
      const sessionTitle = String(data.sessionTitle || 'Ca dạy');
      const sessionTime = String(data.sessionTime || '');
      const reason = data.rejectionReason
        ? ` Lý do từ chối: ${String(data.rejectionReason)}`
        : data.reasonMessage
          ? ` Lý do: ${String(data.reasonMessage)}`
          : '';
      if (actor.role === UserRole.COACH) {
        title = approved
          ? 'Đơn xin nghỉ ca đã được duyệt'
          : 'Đơn xin nghỉ ca bị từ chối';
        message = approved
          ? `${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã được duyệt nghỉ khẩn cấp.${reason}`
          : `${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} bị từ chối hủy ca.${reason}`;
      } else {
        title = approved
          ? 'Đã duyệt đơn nghỉ ca HLV'
          : 'Đã từ chối đơn nghỉ ca HLV';
        message = `Yêu cầu hủy ca ${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã được ${approved ? 'phê duyệt' : 'từ chối'}.`;
      }
      if (data.id) dedupeKey = `cancel-req-${String(data.id)}-${String(data.status || '')}`;
    } else if (eventName === 'booking.cancelled') {
      type = 'cancellation';
      urgent = true;
      const isLate = Boolean(data.isLateCancellation);
      const refunded = Boolean(data.refunded);
      const sessionTitle = String(data.sessionTitle || 'Buổi tập');
      const sessionTime = String(data.sessionTime || '');
      const memberName = String(data.memberName || 'Học viên');
      if (actor.role === UserRole.MEMBER) {
        title = isLate ? 'Hủy lịch sát giờ (< 2 tiếng)' : 'Xác nhận hủy lịch & Hoàn lượt tập';
        message = refunded
          ? `Bạn đã hủy lịch ${sessionTitle}${sessionTime ? ` lúc ${sessionTime}` : ''}. 1 lượt tập đã được hoàn trả.`
          : `Bạn đã hủy sát giờ ${sessionTitle}${sessionTime ? ` lúc ${sessionTime}` : ''}. Theo quy định (< 2h), lượt tập không được hoàn trả.`;
      } else if (actor.role === UserRole.COACH) {
        title = isLate
          ? 'Học viên hủy sát giờ (Vẫn nhận thù lao)'
          : 'Học viên hủy lịch ca tập';
        message = String(
          data.coachMessage ||
            `${memberName} vừa hủy ${sessionTitle}${sessionTime ? ` lúc ${sessionTime}` : ''}${isLate ? ' (Sát giờ < 2h — HLV vẫn được tính thù lao)' : ' — Slot đã mở lại để học viên khác đặt'}.`,
        );
      } else {
        title = 'Học viên hủy lịch ca tập';
        message = String(
          data.message ||
            `${memberName} vừa hủy ${sessionTitle}${sessionTime ? ` lúc ${sessionTime}` : ''}.`,
        );
      }
      if (data.bookingId) dedupeKey = `booking-${String(data.bookingId)}`;
    } else if (eventName === 'session.cancelled') {
      type = 'cancellation';
      urgent = true;
      const sessionTitle = String(data.sessionTitle || data.className || 'Ca tập');
      const sessionTime = String(data.sessionTime || data.startTime || '');
      const reason = data.reasonMessage ? ` Lý do: ${String(data.reasonMessage)}.` : '';
      title = 'Ca tập đã hủy & Hoàn 100% lượt tập';
      message = String(
        data.message ||
          `${sessionTitle}${sessionTime ? ` (${sessionTime})` : ''} đã bị hủy do HLV xin nghỉ.${reason} Hệ thống đã hoàn trả 100% lượt tập vào gói của bạn.`,
      );
      if (data.bookingId) dedupeKey = `booking-${String(data.bookingId)}`;
      else if (data.scheduleId) dedupeKey = `sched-cancel-${String(data.scheduleId)}`;
    } else if (eventName === 'schedule.updated') {
      const isCancel =
        data.status === 'CANCELLED_BY_COACH' || data.status === 'CANCELLED';
      type = isCancel ? 'cancellation' : 'booking';
      urgent = isCancel;
      if (actor.role === UserRole.COACH) {
        title = isCancel ? 'Lịch dạy đã đóng / hủy ca' : 'Cập nhật lịch dạy';
        message = String(
          data.coachMessage ||
            data.message ||
            (isCancel
              ? 'Quản lý đã đóng hoặc hủy lịch lớp học này. Bạn không bị kỷ luật.'
              : 'Lịch dạy của bạn vừa được cập nhật.'),
        );
      } else {
        title = isCancel ? 'Ca học đã hủy & Hoàn 100% lượt tập' : 'Cập nhật lịch học';
        message = String(
          data.memberMessage ||
            data.message ||
            (isCancel
              ? 'Lớp học đã được đóng hoặc hủy. 100% lượt tập đã được hoàn trả lại vào tài khoản.'
              : 'Lịch học đã được cập nhật.'),
        );
      }
      if (data.scheduleId && isCancel) {
        dedupeKey = `sched-cancel-${String(data.scheduleId)}`;
      }
    } else if (eventName === 'class.auto_cancelled') {
      type = 'cancellation';
      urgent = true;
      if (actor.role === UserRole.COACH) {
        title = 'Lớp tự động hủy (Thiếu sĩ số < 60%)';
        message = String(
          data.message ||
            'Lớp học tự động hủy do không đạt 60% sĩ số trước 2 ngày. Bạn không bị kỷ luật.',
        );
      } else {
        title = 'Lớp tự động hủy & Hoàn 100% lượt tập';
        message = String(
          data.message ||
            'Lớp học đã tự động hủy do không đạt sĩ số tối thiểu. Hệ thống đã hoàn trả 1 lượt tập cho bạn.',
        );
      }
      if (data.scheduleId) dedupeKey = `sched-cancel-${String(data.scheduleId)}`;
    } else if (eventName === 'substitution.invited') {
      type = 'cancellation';
      urgent = true;
      title = 'Lời mời dạy thay ca';
      message = String(
        data.message ||
          'Quản lý vừa chỉ định bạn dạy thay một ca tập. Vui lòng phản hồi sớm.',
      );
    } else if (eventName === 'substitution.responded') {
      type = 'cancellation';
      const accepted = data.status === 'ACCEPTED';
      urgent = !accepted;
      title = accepted ? 'HLV đã nhận dạy thay' : 'HLV từ chối dạy thay';
      message = accepted
        ? `${String(data.substituteCoachName || 'HLV')} đã nhận dạy thay ca học.`
        : `${String(data.substituteCoachName || 'HLV')} đã từ chối ca dạy thay${data.reason ? `: ${String(data.reason)}` : ''}.`;
    } else if (eventName === 'schedule.assigned') {
      type = 'booking';
      title = 'Bạn vừa được gán ca dạy mới';
      message = 'Quản lý vừa xếp lịch lớp học mới cho bạn.';
    } else if (eventName === 'slot.approved') {
      type = 'booking';
      title = 'Ca ngoài giờ đã được duyệt';
      message = 'Quản lý đã phê duyệt ca dạy ngoài giờ của bạn.';
    } else if (eventName === 'slot.rejected') {
      type = 'cancellation';
      urgent = true;
      title = 'Ca ngoài giờ không được duyệt';
      message = `Quản lý đã từ chối yêu cầu ca ngoại lệ${data.reason ? `: ${String(data.reason)}` : '.'}`;
    }

    return {
      dedupeKey,
      item: {
        id: row.id,
        eventName,
        type,
        title,
        message,
        createdAt,
        read,
        urgent,
        link,
        metadata: data,
      },
    };
  }

  async listForActor(actor: Actor): Promise<{
    items: InAppNotificationItem[];
    unreadCount: number;
  }> {
    const since = new Date(Date.now() - 21 * 86400000);
    const [persistedRows, readMarkerRows] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          action: 'IN_APP_NOTIFICATION',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
        select: { id: true, createdAt: true, afterState: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          userId: actor.userId,
          action: 'IN_APP_NOTIFICATION_READ',
          createdAt: { gte: since },
        },
        select: { afterState: true },
      }),
    ]);

    const readHistoricalIds = new Set<string>();
    let markAllBeforeMs = 0;
    for (const m of readMarkerRows) {
      const state = (m.afterState ?? {}) as {
        notifId?: string;
        markAllBefore?: string;
      };
      if (state.notifId) readHistoricalIds.add(state.notifId);
      if (state.markAllBefore) {
        const ms = new Date(state.markAllBefore).getTime();
        if (!Number.isNaN(ms) && ms > markAllBeforeMs) markAllBeforeMs = ms;
      }
    }

    const items: InAppNotificationItem[] = [];
    const seenKeys = new Set<string>();

    for (const row of persistedRows) {
      const formatted = this.formatPersistedEvent(row, actor);
      if (!formatted) continue;
      if (formatted.dedupeKey) seenKeys.add(formatted.dedupeKey);
      const isMarkedAll =
        markAllBeforeMs > 0 &&
        new Date(formatted.item.createdAt).getTime() <= markAllBeforeMs;
      items.push({
        ...formatted.item,
        read: formatted.item.read || isMarkedAll,
      });
    }

    // Tổng hợp thêm lịch sử hủy gần đây (14 ngày) từ DB nếu sự kiện xảy ra trước khi có bảng/hook lưu thông báo
    const histSince = new Date(Date.now() - 14 * 86400000);

    if (actor.role === UserRole.COACH) {
      const [cancelledBookings, myRequests, cancelledSchedules] =
        await Promise.all([
          this.prisma.booking.findMany({
            where: {
              status: 'CANCELLED',
              cancelledAt: { gte: histSince },
              OR: [
                { schedule: { coachId: actor.userId } },
                { coachAvailability: { coachId: actor.userId } },
              ],
            },
            include: {
              member: { select: { fullName: true } },
              schedule: { include: { class: true } },
              coachAvailability: true,
              subscription: { include: { plan: true } },
            },
            orderBy: { cancelledAt: 'desc' },
            take: 25,
          }),
          this.prisma.cancellationRequest.findMany({
            where: {
              coachId: actor.userId,
              createdAt: { gte: histSince },
              status: { in: ['APPROVED', 'REJECTED'] },
            },
            include: {
              schedule: { include: { class: true } },
              booking: {
                include: {
                  coachAvailability: true,
                  subscription: { include: { plan: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
          }),
          this.prisma.schedule.findMany({
            where: {
              coachId: actor.userId,
              status: 'CANCELLED_BY_COACH',
              startTime: { gte: histSince },
            },
            include: { class: true },
            orderBy: { startTime: 'desc' },
            take: 15,
          }),
        ]);

      for (const b of cancelledBookings) {
        const key = `booking-${b.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const sTime = b.schedule?.startTime || b.coachAvailability?.startTime;
        const timeStr = formatHnDateTime(sTime);
        const sessionTitle =
          b.schedule?.class?.name ||
          b.subscription?.plan?.name ||
          'Ca tập PT 1-1';
        const memberName = b.member?.fullName || 'Học viên';
        const histId = `hist-booking-${b.id}`;
        const createdAt = (b.cancelledAt || b.bookedAt).toISOString();
        const isMarkedAll =
          markAllBeforeMs > 0 && new Date(createdAt).getTime() <= markAllBeforeMs;

        let title = 'Ca tập đã bị hủy';
        let message = `${sessionTitle}${timeStr ? ` (${timeStr})` : ''} đã bị hủy.`;
        if (b.cancelledBy === 'MEMBER') {
          title = b.isLateCancellation
            ? 'Học viên hủy sát giờ (Vẫn nhận thù lao)'
            : 'Học viên hủy lịch ca tập';
          message = `${memberName} đã hủy ${sessionTitle}${timeStr ? ` lúc ${timeStr}` : ''}${b.isLateCancellation ? ' (Hủy sát giờ < 2h — Bạn vẫn nhận thù lao)' : ' — Slot đã mở lại'}.${b.cancellationReason ? ` Lý do: ${b.cancellationReason}` : ''}`;
        } else if (b.cancelledBy === 'COACH' || b.isEmergencyCancellation) {
          title = 'Ca dạy đã hủy theo đơn nghỉ khẩn cấp';
          message = `${sessionTitle}${timeStr ? ` (${timeStr})` : ''} của học viên ${memberName} đã được hủy khẩn cấp.${b.cancellationReason ? ` Lý do: ${b.cancellationReason}` : ''}`;
        } else if (b.cancelledBy === 'MANAGER' || b.cancelledBy === 'SYSTEM') {
          title = 'Ca học đã hủy / đóng lớp';
          message = `${sessionTitle}${timeStr ? ` (${timeStr})` : ''} đã được đóng/hủy.${b.cancellationReason ? ` (${b.cancellationReason})` : ''}`;
        }

        items.push({
          id: histId,
          eventName: 'booking.cancelled',
          type: 'cancellation',
          title,
          message,
          createdAt,
          read: readHistoricalIds.has(histId) || isMarkedAll,
          urgent: true,
          link: '/portal/coach/schedule',
          metadata: {
            bookingId: b.id,
            scheduleId: b.scheduleId,
            coachAvailabilityId: b.coachAvailabilityId,
            isLateCancellation: b.isLateCancellation,
            cancelledBy: b.cancelledBy,
            reason: b.cancellationReason,
          },
        });
      }

      for (const req of myRequests) {
        const key = `cancel-req-${req.id}-${req.status}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const approved = req.status === 'APPROVED';
        const sTime =
          req.schedule?.startTime || req.booking?.coachAvailability?.startTime;
        const timeStr = formatHnDateTime(sTime);
        const sessionTitle =
          req.schedule?.class?.name ||
          req.booking?.subscription?.plan?.name ||
          'Ca tập PT 1-1';
        const histId = `hist-req-${req.id}-${req.status}`;
        const createdAt = (req.reviewedAt || req.createdAt).toISOString();
        const isMarkedAll =
          markAllBeforeMs > 0 && new Date(createdAt).getTime() <= markAllBeforeMs;

        items.push({
          id: histId,
          eventName: 'cancellation.reviewed',
          type: 'cancellation',
          title: approved
            ? 'Đơn xin nghỉ ca đã được duyệt'
            : 'Đơn xin nghỉ ca bị từ chối',
          message: approved
            ? `${sessionTitle}${timeStr ? ` (${timeStr})` : ''} đã được duyệt nghỉ khẩn cấp. Lý do: ${req.reasonMessage}`
            : `${sessionTitle}${timeStr ? ` (${timeStr})` : ''} bị từ chối hủy ca.${req.rejectionReason ? ` Lý do: ${req.rejectionReason}` : ''}`,
          createdAt,
          read: readHistoricalIds.has(histId) || isMarkedAll,
          urgent: true,
          link: '/portal/coach/schedule',
          metadata: {
            requestId: req.id,
            status: req.status,
            scheduleId: req.scheduleId,
            bookingId: req.bookingId,
          },
        });
      }

      for (const sched of cancelledSchedules) {
        const key = `sched-cancel-${sched.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const timeStr = formatHnDateTime(sched.startTime);
        const histId = `hist-sched-${sched.id}`;
        const createdAt = sched.createdAt.toISOString();
        const isMarkedAll =
          markAllBeforeMs > 0 && new Date(createdAt).getTime() <= markAllBeforeMs;

        items.push({
          id: histId,
          eventName: 'schedule.updated',
          type: 'cancellation',
          title: 'Lớp học đã bị hủy / đóng ca',
          message: `Lớp ${sched.class?.name || 'Nhóm'}${timeStr ? ` (${timeStr})` : ''} đã ngừng diễn ra.`,
          createdAt,
          read: readHistoricalIds.has(histId) || isMarkedAll,
          urgent: true,
          link: '/portal/coach/schedule',
          metadata: { scheduleId: sched.id, status: sched.status },
        });
      }
    } else if (actor.role === UserRole.MEMBER) {
      const cancelledBookings = await this.prisma.booking.findMany({
        where: {
          memberId: actor.userId,
          status: 'CANCELLED',
          cancelledAt: { gte: histSince },
        },
        include: {
          schedule: {
            include: {
              class: true,
              coach: { select: { fullName: true } },
            },
          },
          coachAvailability: {
            include: {
              coach: { select: { fullName: true } },
            },
          },
          subscription: { include: { plan: true } },
        },
        orderBy: { cancelledAt: 'desc' },
        take: 25,
      });

      for (const b of cancelledBookings) {
        const key = `booking-${b.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const sTime = b.schedule?.startTime || b.coachAvailability?.startTime;
        const timeStr = formatHnDateTime(sTime);
        const sessionTitle =
          b.schedule?.class?.name ||
          b.subscription?.plan?.name ||
          'Ca tập PT 1-1';
        const coachName =
          b.schedule?.coach?.fullName || b.coachAvailability?.coach?.fullName;
        const histId = `hist-booking-${b.id}`;
        const createdAt = (b.cancelledAt || b.bookedAt).toISOString();
        const isMarkedAll =
          markAllBeforeMs > 0 && new Date(createdAt).getTime() <= markAllBeforeMs;

        const isSelfCancel = b.cancelledBy === 'MEMBER';
        const title = isSelfCancel
          ? b.isLateCancellation
            ? 'Đã hủy lịch sát giờ (< 2 tiếng)'
            : 'Đã hủy lịch & Hoàn 1 lượt tập'
          : 'Ca học bị hủy & Hoàn 100% lượt tập';
        const message = isSelfCancel
          ? b.isLateCancellation
            ? `Bạn đã hủy sát giờ ${sessionTitle}${timeStr ? ` lúc ${timeStr}` : ''}. Lượt tập không được hoàn lại.`
            : `Bạn đã hủy ${sessionTitle}${timeStr ? ` lúc ${timeStr}` : ''}. 1 lượt tập đã được hoàn lại vào gói.`
          : `${sessionTitle}${timeStr ? ` (${timeStr})` : ''}${coachName ? ` · HLV ${coachName}` : ''} đã bị hủy.${b.cancellationReason ? ` Lý do: ${b.cancellationReason}.` : ''} Hệ thống đã hoàn trả 100% lượt tập.`;

        items.push({
          id: histId,
          eventName: isSelfCancel ? 'booking.cancelled' : 'session.cancelled',
          type: 'cancellation',
          title,
          message,
          createdAt,
          read: readHistoricalIds.has(histId) || isMarkedAll,
          urgent: true,
          link: '/portal/member/bookings',
          metadata: {
            bookingId: b.id,
            scheduleId: b.scheduleId,
            cancelledBy: b.cancelledBy,
            reason: b.cancellationReason,
          },
        });
      }
    } else if (
      actor.role === UserRole.CENTER_MANAGER ||
      actor.role === UserRole.RECEPTIONIST ||
      actor.role === UserRole.ADMIN
    ) {
      const pendingRequests = await this.prisma.cancellationRequest.findMany({
        where: {
          createdAt: { gte: histSince },
          status: 'PENDING',
        },
        include: {
          coach: { select: { fullName: true } },
          schedule: { include: { class: true } },
          booking: {
            include: {
              coachAvailability: true,
              subscription: { include: { plan: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });

      for (const req of pendingRequests) {
        const key = `cancel-req-${req.id}-PENDING`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const sTime =
          req.schedule?.startTime || req.booking?.coachAvailability?.startTime;
        const timeStr = formatHnDateTime(sTime);
        const sessionTitle =
          req.schedule?.class?.name ||
          req.booking?.subscription?.plan?.name ||
          'Ca tập PT 1-1';
        const histId = `hist-req-${req.id}-PENDING`;
        const createdAt = req.createdAt.toISOString();
        const isMarkedAll =
          markAllBeforeMs > 0 && new Date(createdAt).getTime() <= markAllBeforeMs;

        items.push({
          id: histId,
          eventName: 'cancellation.requested',
          type: 'cancellation',
          title: 'Yêu cầu hủy ca khẩn cấp chờ duyệt',
          message: `HLV ${req.coach?.fullName || ''} xin nghỉ ${sessionTitle}${timeStr ? ` (${timeStr})` : ''}: "${req.reasonMessage}"`.trim(),
          createdAt,
          read: readHistoricalIds.has(histId) || isMarkedAll,
          urgent: true,
          link:
            actor.role === UserRole.RECEPTIONIST
              ? '/portal/desk'
              : '/portal/manager/penalties',
          metadata: { requestId: req.id, coachId: req.coachId },
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const trimmed = items.slice(0, 50);
    const unreadCount = trimmed.filter((n) => !n.read).length;

    return { items: trimmed, unreadCount };
  }

  async markRead(id: string, actor: Actor) {
    if (id.startsWith('hist-')) {
      await this.prisma.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'IN_APP_NOTIFICATION_READ',
          targetEntity: 'notifications',
          afterState: { notifId: id } as Prisma.InputJsonValue,
        },
      });
      return { id, read: true };
    }

    const row = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!row || row.action !== 'IN_APP_NOTIFICATION') {
      return { id, read: true };
    }
    const state = (row.afterState ?? {}) as Record<string, unknown>;
    const readBy = Array.isArray(state.readBy)
      ? Array.from(new Set([...state.readBy.map(String), actor.userId]))
      : [actor.userId];
    await this.prisma.auditLog.update({
      where: { id },
      data: {
        afterState: { ...state, readBy } as Prisma.InputJsonValue,
      },
    });
    return { id, read: true };
  }

  async markAllRead(actor: Actor) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: 'IN_APP_NOTIFICATION_READ',
        targetEntity: 'notifications',
        afterState: {
          markAllBefore: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  }
}
