import React, { useState, useEffect } from 'react';
import { WarrantyRecord, RepairJob } from '../../types';
import { ApiClient } from '../../api/client';
import {
  ShieldCheck,
  Smartphone,
  Calendar,
  Layers,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export const WarrantyPassportView: React.FC = () => {
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [completedJobs, setCompletedJobs] = useState<RepairJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      ApiClient.getMyWarranties().catch(() => []),
      ApiClient.getJobs().catch(() => []),
    ])
      .then(([wList, jList]) => {
        setWarranties(wList || []);
        setCompletedJobs((jList || []).filter((j) => j.status === 'COMPLETED'));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div id="warranty-passport-view" className="space-y-6">
      {/* Passport Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Device Health & History Records</span>
        </div>
        <h2 className="text-xl font-black text-white">Digital Repair Passport & Warranties</h2>
        <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
          Every repair performed via Fixhub creates an immutable digital passport entry with part serials, quality grades, and active warranty terms.
        </p>
      </div>

      {/* Active Warranties List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Active Warranty Policies</h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {warranties.filter((w) => w.status === 'ACTIVE').length} Active
          </span>
        </div>

        {warranties.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No active warranties yet</p>
            <p className="text-xs text-slate-400">Complete a repair to receive an automatic 60-90 day warranty certificate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warranties.map((w) => {
              const startDate = new Date(w.startDate);
              const endDate = new Date(w.endDate);
              const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

              return (
                <div
                  key={w.id}
                  id={`warranty-card-${w.id}`}
                  className="bg-white p-5 rounded-2xl border-2 border-emerald-200 shadow-sm space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {w.status === 'ACTIVE' ? 'Active Coverage' : w.status}
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-1.5">{w.deviceBrand} {w.deviceModel}</h4>
                      <p className="text-xs text-slate-500">Repair Job: <span className="font-mono text-slate-700">{w.repairJobId}</span></p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-700">{daysLeft}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Days Left</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Covered Repairs & Parts:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(w.coveredRepairs)
                          ? w.coveredRepairs
                          : (w.coveredRepair ? w.coveredRepair.split(',').map((s) => s.trim()) : ['Standard Hardware Coverage'])
                        ).map((rep, idx) => (
                          <span key={idx} className="bg-white border border-slate-200 text-slate-800 font-medium px-2 py-0.5 rounded text-[11px]">
                            {rep}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start Date:</span>
                        <span className="font-semibold text-slate-700">{startDate.toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Expires:</span>
                        <span className="font-semibold text-slate-700">{endDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Terms: {w.terms}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Passport Timeline Entries */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="font-bold text-slate-900 text-base">Completed Service Passports</h3>
        {completedJobs.length === 0 ? (
          <p className="text-xs text-slate-400">Completed jobs will be preserved in your digital passport.</p>
        ) : (
          <div className="space-y-3">
            {completedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{job.deviceBrand} {job.deviceModel}</h4>
                    <p className="text-xs text-slate-500">Fixed: {(job.issues || []).join(', ')} • ₦{(job.finalAmount || 0).toLocaleString()}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  {new Date(job.completedAt || job.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
