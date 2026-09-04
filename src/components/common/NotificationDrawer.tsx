import React from 'react';
import { NotificationItem } from '../../types';
import { ApiClient } from '../../api/client';
import {
  Bell,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Wrench,
  X,
  Clock
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
  onSelectRepair?: (repairId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onSelectRepair,
}) => {
  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    await ApiClient.markAllNotificationsRead();
    onRefresh();
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await ApiClient.markNotificationRead(item.id);
      onRefresh();
    }
    if (item.repairId && onSelectRepair) {
      onSelectRepair(item.repairId);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'QUOTE':
        return <DollarSign className="w-4 h-4 text-cyan-600" />;
      case 'PAYMENT':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'WARRANTY':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default:
        return <Wrench className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div
      id="notification-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        id="notification-drawer-content"
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">Notifications</h3>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
              {notifications.filter((n) => !n.read).length} Unread
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No notifications yet</p>
              <p className="text-xs text-slate-400 mt-1">Status changes and quotes will appear here.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  item.read
                    ? 'border-slate-100 bg-slate-50/60 opacity-80 hover:opacity-100'
                    : 'border-blue-200 bg-blue-50/40 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                    {getIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.message}</p>
                    {item.repairId && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 mt-1.5 hover:underline">
                        View Repair Job →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
