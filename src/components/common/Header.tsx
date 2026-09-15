import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { FixhubLogo } from './FixhubLogo';
import {
  Wrench,
  User as UserIcon,
  Bell,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  unreadNotifsCount: number;
  onOpenProfile?: () => void;
  onOpenIntro?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  unreadNotifsCount,
  onOpenProfile,
  onOpenIntro,
}) => {
  const { user, role, isBorrowedDevice, logout } = useAuth();

  return (
    <>
      {/* Borrowed Phone Safety Top Bar */}
      {isBorrowedDevice && (
        <div
          id="borrowed-device-banner"
          className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Borrowed Device Mode: Safe session active. Please log out when done.</span>
          </div>
          <button
            id="borrowed-mode-logout-btn"
            onClick={logout}
            className="underline hover:text-white transition-colors cursor-pointer text-xs"
          >
            Safe Wipe & Logout
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <header
        id="main-app-header"
        className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 backdrop-blur-md shadow-xs"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <FixhubLogo size="md" theme="dark" variant="full" />
            <span className="hidden md:inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-semibold border border-blue-400/30">
              {role === 'technician' ? 'Technician Portal' : 'Customer Marketplace'}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* How Fixhub Works / Guide Quick Button */}
            {onOpenIntro && (
              <button
                id="header-intro-guide-btn"
                onClick={onOpenIntro}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                title="How Fixhub Works"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>How it works</span>
              </button>
            )}

            {/* User Avatar / Profile Shortcut Button */}
            <button
              id="open-account-menu-btn"
              onClick={onOpenProfile}
              title="View Account Profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
            >
              {role === 'technician' ? (
                <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span className="text-white font-semibold max-w-[120px] truncate">
                {user?.name || 'Profile'}
              </span>
            </button>

            {/* Notifications Bell */}
            <button
              id="notifications-bell-btn"
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
