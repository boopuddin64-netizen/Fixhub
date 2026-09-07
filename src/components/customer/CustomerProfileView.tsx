import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  ShieldCheck,
  MapPin,
  Smartphone,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Lock
} from 'lucide-react';

interface CustomerProfileViewProps {
  onViewWarranties: () => void;
  onOpenDevicesManager?: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  onViewWarranties,
  onOpenDevicesManager,
}) => {
  const { user, customerProfile, logout, isBorrowedDevice } = useAuth();

  return (
    <div id="customer-profile-view" className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-extrabold text-2xl text-white shadow-md">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-white truncate">{user?.name}</h2>
          <p className="text-xs text-slate-400">{user?.email}</p>
          <p className="text-xs text-cyan-300 mt-0.5">{user?.phone}</p>
        </div>
      </div>

      {/* Borrowed Phone Notice */}
      {isBorrowedDevice && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Borrowed Phone Protection Active</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            You are logged into Fix Hub from a temporary/borrowed device. Your token will expire quickly and will not persist locally.
          </p>
          <button
            onClick={logout}
            className="text-xs font-bold text-amber-900 underline hover:text-black cursor-pointer"
          >
            Wipe Session & Log Out Now
          </button>
        </div>
      )}

      {/* Quick Navigation Items */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {onOpenDevicesManager && (
          <button
            id="profile-my-devices-btn"
            onClick={onOpenDevicesManager}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">My Saved Devices</p>
                <p className="text-xs text-slate-500">Manage registered phones, colors, and storage</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <button
          onClick={onViewWarranties}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Digital Repair Passport & Warranties</p>
              <p className="text-xs text-slate-500">View active coverage and authentic parts log</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Default Service Location</p>
              <p className="text-xs text-slate-500">Aba Road, Garrison, Port Harcourt, Rivers State</p>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Fix Hub Escrow Protection</p>
              <p className="text-xs text-slate-500">100% money back on unauthorized alterations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-3.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Fix Hub</span>
        </button>
      </div>
    </div>
  );
};
