import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, TrendingUp, AlertCircle, Calendar, Award, AlertTriangle } from 'lucide-react';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../../services/notification.service';

const POLL_INTERVAL_MS = 60_000; // refresh unread count every 60 seconds

const TYPE_META = {
  MISSING_TRANSACTION: {
    icon: AlertCircle,
    iconClass: 'text-amber-500 bg-amber-50',
  },
  WEEKLY_REPORT: {
    icon: TrendingUp,
    iconClass: 'text-blue-500 bg-blue-50',
  },
  BUDGET_ALERT: {
    icon: AlertCircle,
    iconClass: 'text-red-500 bg-red-50',
  },
  DEBT_DUE: {
    icon: Calendar,
    iconClass: 'text-rose-500 bg-rose-50',
  },
  SAVINGS_MILESTONE: {
    icon: Award,
    iconClass: 'text-emerald-500 bg-emerald-50',
  },
  ANOMALY: {
    icon: AlertTriangle,
    iconClass: 'text-red-500 bg-red-50',
  },
};

const formatRelativeTime = (dateStr) => {
  // Ensure UTC parsing: append 'Z' if the string has no timezone indicator.
  // Without this, browsers parse "2026-06-11 21:00:00" as local time, causing
  // a 7-hour offset when the DB server is UTC and local timezone is +07:00.
  const normalized = dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')
    ? dateStr.replace(' ', 'T') + 'Z'
    : dateStr;
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch unread badge count (lightweight, polled every minute)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silent — badge not critical
    }
  }, []);

  // Fetch full list when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count in background
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list on open
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id) => {
    try {
      await markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // Silent
    }
  };

  return (
    <>
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={() => setOpen(v => !v)}
        className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        aria-label="Thông báo"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-blue-500 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={13} />
                  Đọc tất cả
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                Đang tải...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Bell size={32} className="opacity-30" />
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.MISSING_TRANSACTION;
                const Icon = meta.icon;
                const isUnread = !n.is_read;

                return (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (isUnread) {
                        await handleMarkRead(n.id);
                      }
                      setActiveNotification({ ...n, is_read: 1 });
                    }}
                    className={`flex gap-3 px-4 py-3.5 border-b border-slate-50 transition-colors cursor-pointer ${
                      isUnread
                        ? 'bg-blue-50/40 hover:bg-blue-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconClass}`}>
                      <Icon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {/* Strip markdown for preview */}
                        {n.body.replace(/\*\*/g, '').split('\n')[0]}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>

    {/* Detail Modal */}
    {activeNotification && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setActiveNotification(null)}
        />

        {/* Modal Container */}
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${TYPE_META[activeNotification.type]?.iconClass || 'text-slate-500 bg-slate-50'}`}>
                {(() => {
                  const Icon = TYPE_META[activeNotification.type]?.icon || AlertCircle;
                  return <Icon size={15} />;
                })()}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {activeNotification.type === 'WEEKLY_REPORT' ? 'Báo cáo tuần' : 'Thông báo'}
              </span>
            </div>
            <button
              onClick={() => setActiveNotification(null)}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content Body */}
          <div className="px-6 py-5 max-h-[380px] overflow-y-auto">
            <h3 className="text-base font-black text-slate-800 mb-3 leading-snug">
              {activeNotification.title}
            </h3>
            {renderNotificationBody(activeNotification.body)}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
            <button
              onClick={() => setActiveNotification(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors shadow-sm"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

function renderNotificationBody(text) {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        
        // Check if it's a list item
        const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-');
        if (isBullet) {
          trimmed = trimmed.substring(1).trim();
        }
        
        // Parse bold text **something**
        const parts = [];
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        let lastIndex = 0;
        
        while ((match = boldRegex.exec(trimmed)) !== null) {
          const matchIndex = match.index;
          // Add preceding text
          if (matchIndex > lastIndex) {
            parts.push(trimmed.substring(lastIndex, matchIndex));
          }
          // Add bold text
          parts.push(<strong key={matchIndex} className="font-semibold text-slate-800">{match[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        
        if (lastIndex < trimmed.length) {
          parts.push(trimmed.substring(lastIndex));
        }
        
        if (isBullet) {
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>{parts.length > 0 ? parts : trimmed}</span>
            </div>
          );
        }
        
        return (
          <p key={idx} className={trimmed ? "" : "h-2"}>
            {parts.length > 0 ? parts : trimmed}
          </p>
        );
      })}
    </div>
  );
}
