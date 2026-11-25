import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  Bell,
  CheckCheck,
  Trash2,
  ScanLine,
  AlertTriangle,
  CreditCard,
  Calendar,
  Key,
  Info,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useNotification, type AppNotification, type NotificationType } from '@/context/notification-context';

function formatRelativeTime(dateStr: string): string {
  try {
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} ngày trước`;
  } catch {
    return '';
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'checkin':
      return <ScanLine className="h-4 w-4 text-emerald-600" />;
    case 'cancellation':
      return <AlertTriangle className="h-4 w-4 text-rose-600" />;
    case 'payment':
      return <CreditCard className="h-4 w-4 text-blue-600" />;
    case 'booking':
      return <Calendar className="h-4 w-4 text-purple-600" />;
    case 'locker':
      return <Key className="h-4 w-4 text-teal-600" />;
    default:
      return <Info className="h-4 w-4 text-slate-500" />;
  }
}

export const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    refreshNotifications,
    isConnected,
  } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedItem, setSelectedItem] = useState<AppNotification | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    void refreshNotifications();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, refreshNotifications]);

  const displayedNotifications = notifications.filter((n) =>
    filter === 'all' ? true : !n.read
  );

  const handleOpenItem = (item: AppNotification) => {
    markAsRead(item.id);
    setSelectedItem({ ...item, read: true });
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={isConnected ? 'Mở hộp thông báo thời gian thực' : 'Mở hộp thông báo'}
        className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-slate-100 text-slate-900 ring-2 ring-slate-200'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
          title={isConnected ? 'Realtime kết nối' : 'Đang thử kết nối lại'}
        />
      </button>

      {/* Notification Modal */}
      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99990] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Hộp thông báo"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#17664e]/10 text-[#17664e] flex items-center justify-center">
                    <Bell className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-slate-900">Thông báo hệ thống</h2>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          {unreadCount} chưa đọc
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isConnected ? '● Đang đồng bộ thời gian thực' : '○ Đang đồng bộ lại'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void refreshNotifications()}
                    title="Làm mới thông báo"
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Đóng hộp thông báo"
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Filter & Mark All Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-2 bg-white text-xs font-semibold">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                      filter === 'all'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tất cả ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('unread')}
                    className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                      filter === 'unread'
                        ? 'border-emerald-600 text-emerald-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chưa đọc ({unreadCount})
                  </button>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Đã đọc hết</span>
                  </button>
                )}
              </div>

              {/* Detail Preview if user clicked an item */}
              {selectedItem && (
                <div className="mx-5 mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      {getNotificationIcon(selectedItem.type)}
                      <span>{selectedItem.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Đóng chi tiết"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedItem.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(selectedItem.createdAt)}
                    </span>
                    {selectedItem.link && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(selectedItem.link!);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#17664e] hover:underline cursor-pointer"
                      >
                        <span>Đi tới trang liên quan</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {displayedNotifications.length === 0 ? (
                  <div className="py-14 text-center text-slate-400">
                    <Bell className="h-9 w-9 mx-auto mb-2.5 opacity-30" />
                    <p className="text-xs font-medium">Không có thông báo nào.</p>
                  </div>
                ) : (
                  displayedNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenItem(item)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl transition-colors cursor-pointer ${
                        selectedItem?.id === item.id
                          ? 'bg-emerald-50 border border-emerald-200'
                          : item.read
                            ? 'bg-white hover:bg-slate-50 opacity-85'
                            : item.type === 'cancellation'
                              ? 'bg-rose-50/70 hover:bg-rose-50'
                              : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="shrink-0 p-2 rounded-xl bg-slate-100 mt-0.5">
                        {getNotificationIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs ${item.read ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'}`}>
                            {item.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                      {!item.read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-rose-600 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/80 flex items-center justify-between text-xs">
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearAll();
                      setSelectedItem(null);
                    }}
                    className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa lịch sử</span>
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
