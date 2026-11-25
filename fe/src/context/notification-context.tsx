import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { apiOrigin, readTokens } from '@/lib/api';
import { apiClient } from '@/services/api-client';
import { X, Bell, CheckCircle2, AlertTriangle } from 'lucide-react';

export type NotificationType = 'checkin' | 'cancellation' | 'payment' | 'booking' | 'locker' | 'system';

export interface AppNotification {
  id: string;
  eventName?: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  urgent?: boolean;
  link?: string;
}

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
  showToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const getStorageKey = (userId?: string) =>
  userId ? `sports_center_notifications_${userId}` : 'sports_center_notifications_guest';

export function playChime(urgent = false) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 880 : 587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(urgent ? 1174.66 : 880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const toastedServerIdsRef = useRef<Set<string>>(new Set());
  const syncTimerRef = useRef<number | null>(null);

  // Load cached notifications when active user changes
  useEffect(() => {
    toastedServerIdsRef.current.clear();
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    try {
      const saved = localStorage.getItem(getStorageKey(user.id));
      setNotifications(saved ? JSON.parse(saved) : []);
    } catch {
      setNotifications([]);
    }
  }, [user?.id]);

  // Persist user-scoped cache
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(getStorageKey(user.id), JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }, [notifications, user?.id]);

  const showToast = useCallback((type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const addNotification = useCallback((type: NotificationType, title: string, message: string, link?: string, urgent = false) => {
    const notif: AppNotification = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      urgent,
      link,
    };
    setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const tokens = readTokens();
    if (!user?.id || !tokens?.accessToken) return;
    try {
      const res = await apiClient.get<{ items?: AppNotification[] }>('/notifications');
      const serverItems = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
          ? (res.data as unknown as AppNotification[])
          : [];

      if (serverItems.length > 0) {
        serverItems.forEach((item) => toastedServerIdsRef.current.add(item.id));
      }

      setNotifications((prev) => {
        // Keep only very recent optimistic local items (within 10s) not yet superseded by server list
        const now = Date.now();
        const freshLocalOnly = prev.filter(
          (p) =>
            p.id.startsWith('local-') &&
            now - new Date(p.createdAt).getTime() < 8000 &&
            !serverItems.some((s) => s.title === p.title && s.message === p.message),
        );
        return [...freshLocalOnly, ...serverItems].slice(0, 50);
      });
    } catch {
      // Silently preserve cached notifications when network is temporarily unavailable
    }
  }, [user?.id, showToast]);

  const scheduleServerSync = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      void refreshNotifications();
    }, 600);
  }, [refreshNotifications]);

  // Initial fetch + focus refresh + light catch-up polling (30s)
  useEffect(() => {
    if (!user?.id) return;
    void refreshNotifications();
    const onFocus = () => void refreshNotifications();
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications();
      }
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [user?.id, refreshNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (!id.startsWith('local-')) {
      void apiClient.put(`/notifications/${encodeURIComponent(id)}/read`).catch(() => {});
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void apiClient.put('/notifications/read-all').catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    void apiClient.put('/notifications/read-all').catch(() => {});
  }, []);

  // Server-Sent Events (SSE) Stream
  useEffect(() => {
    const tokens = readTokens();
    if (!user || !tokens?.accessToken) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const sseUrl = `${apiOrigin()}/api/v1/realtime/sse?token=${encodeURIComponent(tokens.accessToken)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      void refreshNotifications();
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    const scheduleLink =
      user.role === 'COACH'
        ? '/portal/coach/schedule'
        : user.role === 'MEMBER'
          ? '/portal/member/bookings'
          : user.role === 'RECEPTIONIST'
            ? '/portal/desk'
            : '/portal/manager/classes';

    // Listen to domain events
    es.addEventListener('gate.checked-in', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'gate.checked-in', data } }));
        const lockerText = data.lockerNumber ? ` (Tủ: ${data.lockerNumber})` : '';
        addNotification('checkin', 'Quẹt cổng check-in', `Lượt vào cổng mới đã được xác nhận${lockerText}.`, '/portal/desk');
        void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
        void queryClient.invalidateQueries({ queryKey: ['attendances'] });
        void queryClient.invalidateQueries({ queryKey: ['lockers'] });
        void queryClient.invalidateQueries({ queryKey: ['manager', 'lockers'] });
      } catch {}
    });

    es.addEventListener('cancellation.requested', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'cancellation.requested', data } }));
        const reason = data.reasonMessage ? `: "${data.reasonMessage}"` : '';
        if (user.role === 'CENTER_MANAGER' || user.role === 'RECEPTIONIST' || user.role === 'ADMIN') {
          addNotification(
            'cancellation',
            'Yêu cầu hủy ca khẩn cấp',
            `HLV vừa gửi yêu cầu hủy ca đột xuất${reason}.`,
            user.role === 'RECEPTIONIST' ? '/portal/desk' : '/portal/manager/penalties',
            true
          );
          scheduleServerSync();
        } else if (user.role === 'COACH' && data.requestedByReceptionist) {
          addNotification(
            'cancellation',
            'Lễ tân đã tạo đơn nghỉ giúp bạn',
            `Yêu cầu hủy ca đang chờ Quản lý phê duyệt${reason}.`,
            '/portal/coach/requests',
            true
          );
          scheduleServerSync();
        }
        void queryClient.invalidateQueries({ queryKey: ['cancellations'] });
        void queryClient.invalidateQueries({ queryKey: ['front-desk', 'requests'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['manager'] });
      } catch {}
    });

    es.addEventListener('cancellation.cancelled', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'cancellation.cancelled', data } }));
        void queryClient.invalidateQueries({ queryKey: ['cancellations'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'cancellation-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
        void queryClient.invalidateQueries({ queryKey: ['manager'] });
      } catch {}
    });

    es.addEventListener('cancellation.reviewed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'cancellation.reviewed', data } }));
        const approved = data.status === 'APPROVED';
        const sessionTitle = data.sessionTitle || 'Ca dạy';
        const sessionTime = data.sessionTime ? ` (${data.sessionTime})` : '';
        const reason = data.rejectionReason ? ` Lý do: ${data.rejectionReason}` : '';
        addNotification(
          'cancellation',
          approved ? 'Đơn xin nghỉ ca đã được duyệt' : 'Đơn xin nghỉ ca bị từ chối',
          `${sessionTitle}${sessionTime} đã ${approved ? 'được phê duyệt nghỉ khẩn cấp' : 'bị từ chối'}.${reason}`,
          user.role === 'COACH' ? '/portal/coach/schedule' : '/portal/manager/penalties',
          true
        );
        scheduleServerSync();
        void queryClient.invalidateQueries({ queryKey: ['cancellations'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'cancellation-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
        void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
        void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
        void queryClient.invalidateQueries({ queryKey: ['manager'] });
      } catch {}
    });

    es.addEventListener('checkout.paid', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'checkout.paid', data } }));
        addNotification('payment', 'Thanh toán thành công', `Hóa đơn đã được thanh toán thành công (Mã: ${data.checkoutId?.slice(0, 8) || ''}).`, undefined, false);
        void queryClient.invalidateQueries({ queryKey: ['checkout'] });
        void queryClient.invalidateQueries({ queryKey: ['invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['member'] });
      } catch {}
    });

    es.addEventListener('checkout.updated', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'checkout.updated', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['checkout'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['member'] });
    });

    es.addEventListener('booking.created', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'booking.created', data } }));
      } catch {}
      addNotification('booking', 'Lịch đặt mới', 'Có lịch đặt buổi tập mới trong hệ thống.', scheduleLink, false);
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('booking.cancelled', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'booking.cancelled', data } }));
        const isLate = Boolean(data.isLateCancellation);
        const title =
          user.role === 'COACH'
            ? isLate
              ? 'Học viên hủy sát giờ (Vẫn nhận thù lao)'
              : 'Học viên hủy lịch ca tập'
            : user.role === 'MEMBER'
              ? isLate
                ? 'Hủy lịch sát giờ (< 2 tiếng)'
                : 'Xác nhận hủy lịch & Hoàn lượt tập'
              : 'Học viên hủy lịch ca tập';
        const message =
          user.role === 'COACH'
            ? data.coachMessage || data.message || 'Học viên vừa hủy lịch ca tập.'
            : user.role === 'MEMBER'
              ? data.memberMessage || data.message || 'Lịch đặt buổi tập của bạn đã được hủy.'
              : data.message || 'Lịch đặt buổi tập vừa được hủy.';
        addNotification('cancellation', title, message, scheduleLink, true);
        scheduleServerSync();
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
    });

    es.addEventListener('class.auto_cancelled', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'class.auto_cancelled', data } }));
        addNotification(
          'cancellation',
          user.role === 'COACH'
            ? 'Lớp tự động hủy (Thiếu sĩ số < 60%)'
            : 'Lớp tự động hủy & Hoàn 100% lượt tập',
          data.message || 'Lớp học đã bị tự động hủy do không đủ sĩ số tối thiểu.',
          scheduleLink,
          true
        );
        scheduleServerSync();
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    });

    es.addEventListener('booking.updated', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'booking.updated', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('locker.changed', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'locker.changed', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['lockers'] });
      void queryClient.invalidateQueries({ queryKey: ['manager', 'lockers'] });
      void queryClient.invalidateQueries({ queryKey: ['member', user?.id, 'lockers'] });
    });

    es.addEventListener('frontdesk.qr-checkin', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'frontdesk.qr-checkin', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['front-desk'] });
      void queryClient.invalidateQueries({ queryKey: ['attendances'] });
    });

    es.addEventListener('schedule.assigned', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'schedule.assigned', data } }));
        if (user?.role === 'COACH') {
          addNotification('booking', 'Bạn vừa được gán ca dạy mới', 'Quản lý vừa xếp lịch lớp học mới cho bạn.', '/portal/coach/schedule', false);
          scheduleServerSync();
        }
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('substitution.invited', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'substitution.invited', data } }));
        if (user?.role === 'COACH') {
          addNotification('cancellation', 'Lời mời dạy thay ca', 'Quản lý vừa chỉ định bạn dạy thay một ca tập. Vui lòng phản hồi sớm.', '/portal/coach/requests?tab=INVITATIONS', true);
          scheduleServerSync();
        }
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
    });

    es.addEventListener('substitution.responded', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'substitution.responded', data } }));
        if (user?.role === 'CENTER_MANAGER' || user?.role === 'RECEPTIONIST') {
          const accepted = data.status === 'ACCEPTED';
          addNotification(
            'cancellation',
            accepted ? 'HLV đã nhận dạy thay' : 'HLV từ chối dạy thay',
            accepted
              ? `${data.substituteCoachName || 'HLV'} đã nhận dạy thay và tiếp quản ca học trực tiếp.`
              : `${data.substituteCoachName || 'HLV'} đã từ chối ca dạy thay${data.reason ? `: ${data.reason}` : ''}.`,
            '/portal/manager/penalties',
            !accepted
          );
          scheduleServerSync();
        }
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
      void queryClient.invalidateQueries({ queryKey: ['coach'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('schedule.updated', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'schedule.updated', data } }));
        const isCancel = data.status === 'CANCELLED_BY_COACH' || data.status === 'CANCELLED';
        const msg =
          user.role === 'COACH'
            ? data.coachMessage || data.message
            : user.role === 'MEMBER'
              ? data.memberMessage || data.message
              : data.message;
        if (msg || isCancel) {
          addNotification(
            isCancel ? 'cancellation' : 'booking',
            isCancel
              ? user.role === 'COACH'
                ? 'Lịch dạy đã đóng / hủy ca'
                : 'Ca học đã hủy & Hoàn token'
              : 'Cập nhật lịch học',
            msg || 'Lịch học vừa được cập nhật.',
            scheduleLink,
            isCancel
          );
          scheduleServerSync();
        }
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['member'] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    });

    es.addEventListener('session.cancelled', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'session.cancelled', data } }));
        addNotification(
          'cancellation',
          'Ca học đã bị hủy & Hoàn 100% token',
          data.message || 'Ca học của bạn đã bị hủy do HLV xin nghỉ. Lượt tập đã được hoàn trả 100% vào tài khoản của bạn.',
          '/portal/member/bookings',
          true
        );
        scheduleServerSync();
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['member'] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    });

    es.addEventListener('slot.created', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'slot.created', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('slot.deleted', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'slot.deleted', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('subscription.created', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'subscription.created', data } }));
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['member'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'members'] });
    });

    es.addEventListener('slot.approved', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'slot.approved', data } }));
        addNotification('booking', 'Ca ngoài giờ đã được duyệt', 'Quản lý đã phê duyệt ca dạy ngoài giờ của bạn. Ca đã sẵn sàng mở cho học viên!', '/portal/coach/schedule', false);
        scheduleServerSync();
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['manager', 'exceptions'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    es.addEventListener('slot.rejected', (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        window.dispatchEvent(new CustomEvent('app:realtime-event', { detail: { type: 'slot.rejected', data } }));
        const reason = data.reason ? ` Lý do: ${data.reason}` : '';
        addNotification('booking', 'Ca ngoài giờ không được duyệt', `Quản lý đã từ chối yêu cầu ca ngoại lệ.${reason}`, '/portal/coach/schedule', false);
        scheduleServerSync();
      } catch {}
      void queryClient.invalidateQueries({ queryKey: ['manager', 'exceptions'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [user, addNotification, queryClient, refreshNotifications, scheduleServerSync, showToast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        refreshNotifications,
        showToast,
        isConnected,
      }}
    >
      {children}
      {/* Global Toast Container */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                : toast.type === 'warning'
                ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                : toast.type === 'error'
                ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : toast.type === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 animate-bounce" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              ) : (
                <Bell className="h-5 w-5 text-[#17664e]" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-bold uppercase tracking-wider">{toast.title}</p>
              <p className="text-xs mt-0.5 font-medium leading-relaxed opacity-90">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 text-slate-400 hover:text-slate-700 p-0.5 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return ctx;
};
