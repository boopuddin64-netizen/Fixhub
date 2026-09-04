import React, { useState, useEffect } from 'react';
import { RepairJob, TechnicianProfile, DeviceBrand } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Smartphone,
  ChevronRight,
  Lock,
  Layers
} from 'lucide-react';

interface CustomerHomeViewProps {
  onStartRepair: () => void;
  onOpenRepair: (jobId: string) => void;
  onViewWarranties: () => void;
}

export const CustomerHomeView: React.FC<CustomerHomeViewProps> = ({
  onStartRepair,
  onOpenRepair,
  onViewWarranties,
}) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<RepairJob[]>([]);
  const [topTechs, setTopTechs] = useState<TechnicianProfile[]>([]);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);

  useEffect(() => {
    ApiClient.getJobs().then((jobs) => {
      setActiveJobs(jobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED'));
    }).catch(console.error);

    ApiClient.getTechnicians().then((techs) => {
      setTopTechs(techs.slice(0, 3));
    }).catch(console.error);

    ApiClient.getBrands().then(setBrands).catch(console.error);
  }, []);

  return (
    <div id="customer-home-view" className="space-y-6 pb-8">
      {/* Hero Welcome & Primary "Repair My Phone" CTA Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-800">
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-cyan-300 text-xs font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fast, Certified Phone Repairs in Nigeria</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Know who can fix it, what it will cost, and where they are.
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Skip visiting random shops in Computer Village. Compare transparent quotes, pay via secure escrow, and get 60–90 days warranty.
          </p>

          <div className="pt-2">
            <button
              id="hero-repair-my-phone-btn"
              onClick={onStartRepair}
              className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-base px-8 py-4 rounded-2xl shadow-xl shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Wrench className="w-5 h-5 text-white" />
              <span>Repair My Phone</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Decorative ambient elements */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-12 top-4 w-40 h-40 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Active Repair Card (If any active repair exists) */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Active Repair Job</span>
            </h3>
            <span className="text-xs font-bold text-blue-600">In Progress</span>
          </div>

          {activeJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onOpenRepair(job.id)}
              className="bg-white p-5 rounded-2xl border-2 border-blue-500/40 hover:border-blue-600 transition-all shadow-md cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-slate-900">{job.deviceBrand} {job.deviceModel}</h4>
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Issues: <span className="font-semibold text-slate-700">{job.issues.join(', ')}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Escrow: <span className="font-bold text-emerald-700">₦{job.finalAmount.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  Track Live <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Brand Quick-Select */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Select Your Brand to Begin</h3>
          <span className="text-xs text-slate-500">Fast Diagnosis</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={onStartRepair}
              className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Smartphone className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 truncate w-full">{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fix Hub Trust Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">Escrow Payment Hold</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Technicians are paid only AFTER you inspect and approve your fixed phone.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">60 to 90 Days Warranty</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Every completed repair is backed by digital warranty and authentic parts log.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">Digital Repair Passport</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Permanent service records with before/after photos protect resale value.
          </p>
        </div>
      </div>

      {/* Top Nearby Verified Technicians */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Top Rated Technicians Nearby</h3>
          <span className="text-xs text-slate-500">Ikeja, VI & Yaba</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topTechs.map((tech) => (
            <div
              key={tech.userId}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start gap-3">
                <img
                  src={tech.avatarUrl}
                  alt={tech.businessName}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-900 truncate">{tech.businessName}</h4>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{tech.shopLocation.area || tech.shopLocation.city}</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="flex items-center text-xs font-bold text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 mr-0.5" />
                      {tech.rating}
                    </span>
                    <span className="text-[10px] text-slate-400">({tech.completedJobs} jobs)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-semibold">{tech.quoteAccuracyScore}% Quote Accuracy</span>
                <span className="font-medium text-slate-500">~{tech.averageResponseMinutes} min response</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
