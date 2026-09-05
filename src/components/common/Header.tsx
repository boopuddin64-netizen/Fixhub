import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  Wrench,
  User as UserIcon,
  Bell,
  RotateCcw,
  Smartphone,
  ShieldCheck,
  Check,
  LogOut,
  AlertCircle,
  Building2,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  unreadNotifsCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNotifications, unreadNotifsCount }) => {
  const { user, role, logout, isBorrowedDevice } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      await ApiClient.resetSeed();
      setResetSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } finally {
      setIsResetting(false);
    }
  };

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">FIX HUB</span>
                <span className="hidden sm:inline-block text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-semibold border border-blue-400/30">
                  {role === 'technician' ? 'Technician Portal' : 'Customer Marketplace'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 tracking-wide">Find. Fix. Done.</p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User Account & Switcher Menu Button */}
            <button
              id="open-account-menu-btn"
              onClick={() => setShowAccountMenu(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
            >
              {role === 'technician' ? (
                <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span className="text-white font-semibold max-w-[120px] truncate">
                {user?.name || 'Account'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
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

      {/* Account Menu & Logout Modal */}
      {showAccountMenu && (
        <div
          id="account-menu-modal"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-white animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Active Account Session</h3>
                  <p className="text-xs text-slate-400">Authenticated user details</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountMenu(false)}
                className="text-slate-400 hover:text-white p-1 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* User Details */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white">{user?.name}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    role === 'customer'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {role === 'customer' ? 'Customer' : 'Certified Technician'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{user?.email}</p>
              {user?.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                id="switch-account-logout-btn"
                onClick={() => {
                  setShowAccountMenu(false);
                  logout();
                }}
                className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200 border border-red-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out & Return to Login Switch</span>
              </button>

              <button
                id="reset-seed-data-btn"
                onClick={handleResetData}
                disabled={isResetting}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{resetSuccess ? 'Reset Complete!' : 'Reset Demo Database'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
