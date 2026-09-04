import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  Clock,
  Building2,
  CheckCircle2,
  DollarSign,
  Star,
  LogOut
} from 'lucide-react';

export const TechnicianProfileView: React.FC = () => {
  const { user, technicianProfile, logout } = useAuth();

  const verificationStages = [
    { label: 'Government ID & Identity Verified', done: true },
    { label: 'Physical Shop / Counter Inspected in Computer Village', done: true },
    { label: 'CAC Business Registration Confirmed', done: true },
    { label: 'Dedicated Providus Bank Settlement Active', done: true },
  ];

  return (
    <div id="technician-profile-view" className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center gap-4">
        <img
          src={technicianProfile?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
          alt={technicianProfile?.businessName}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-400"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white truncate">{technicianProfile?.businessName}</h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Verified Pro
            </span>
          </div>
          <p className="text-xs text-slate-400">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="flex items-center font-bold text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
              {technicianProfile?.rating || '4.9'}
            </span>
            <span className="text-slate-400">• {technicianProfile?.completedJobs || 214} Completed Repairs</span>
          </div>
        </div>
      </div>

      {/* Trust & Verification Badges */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Fix Hub Verified Technician Credentials</span>
        </h3>

        <div className="space-y-2">
          {verificationStages.map((st, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shop Address & Payout Account */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
        <div className="p-4 flex items-start gap-3">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">Physical Shop Address</span>
            <span className="text-slate-600">{technicianProfile?.shopLocation?.address || '12 Pepple Street, Computer Village, Ikeja, Lagos'}</span>
          </div>
        </div>

        <div className="p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">Operating Hours</span>
            <span className="text-slate-600">{technicianProfile?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM'}</span>
          </div>
        </div>

        <div className="p-4 flex items-start gap-3">
          <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">Settlement Bank Account</span>
            <span className="text-slate-600">Access Bank • 0129849201 • Emeka Okafor Enterprises</span>
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
          <span>Log Out of Technician Portal</span>
        </button>
      </div>
    </div>
  );
};
