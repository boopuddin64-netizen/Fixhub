import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  Wrench,
  User as UserIcon,
  Bell,
  Sparkles,
  RotateCcw,
  Smartphone,
  ShieldCheck,
  Check,
  LogOut,
  AlertCircle
} from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  unreadNotifsCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNotifications, unreadNotifsCount }) => {
  const { user, role, switchDemoUser, logout, isBorrowedDevice } = useAuth();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const demoAccounts = [
    {
      name: 'Tunde Adebayo',
      role: 'Customer',
      email: 'customer@test.fixhub.local',
      location: 'Allen Avenue, Ikeja, Lagos',
      badge: 'Active iPhone 13 Screen Repair',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Emeka Okafor (Emeka Phone Labs)',
      role: 'Technician',
      email: 'technician@test.fixhub.local',
      location: 'Computer Village, Ikeja (0.8 km)',
      badge: '⭐ 4.9 • 214 Completed • Verified Shop',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Kolawole Balogun (VI Hub)',
      role: 'Technician',
      email: 'kola@test.fixhub.local',
      location: 'Victoria Island, Lagos',
      badge: '⭐ 4.8 • 165 Completed',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Fatima Ibrahim (Yaba Express)',
      role: 'Technician',
      email: 'fatima@test.fixhub.local',
      location: 'Herbert Macaulay, Yaba',
      badge: '⭐ 4.7 • 142 Completed',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    },
  ];

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
            {/* 1-Click Role/Account Switcher */}
            <button
              id="open-demo-switcher-btn"
              onClick={() => setShowSwitcher(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
              title="Switch between Customer & Technician Demo Accounts"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Role Switcher:</span>
              <span className="text-white font-semibold capitalize max-w-[120px] truncate">
                {user?.name?.split(' ')[0] || 'Demo User'}
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

      {/* Demo Switcher & Seed Reset Modal */}
      {showSwitcher && (
        <div
          id="demo-switcher-modal"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">1-Click Test Account Switcher</h3>
                  <p className="text-xs text-slate-500">Instantly experience both sides of Fix Hub</p>
                </div>
              </div>
              <button
                onClick={() => setShowSwitcher(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Active Persona:</p>
              {demoAccounts.map((acc) => {
                const isActive = user?.email === acc.email;
                return (
                  <button
                    key={acc.email}
                    onClick={() => {
                      switchDemoUser(acc.email);
                      setShowSwitcher(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.avatar}
                        alt={acc.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{acc.name}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              acc.role === 'Customer'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {acc.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{acc.location}</p>
                        <p className="text-[11px] text-blue-600 font-medium truncate mt-0.5">{acc.badge}</p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                id="reset-seed-data-btn"
                onClick={handleResetData}
                disabled={isResetting}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 font-medium py-2 px-2.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-pointer"
                title="Reset database to initial seed"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{resetSuccess ? 'Reset Complete!' : 'Reset Demo Database'}</span>
              </button>

              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
