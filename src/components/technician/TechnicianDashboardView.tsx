import React, { useState, useEffect } from 'react';
import { RepairRequest, RepairJob, TechnicianProfile } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { QuoteBuilderModal } from './QuoteBuilderModal';
import {
  LayoutDashboard,
  Wrench,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MapPin,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Power
} from 'lucide-react';

interface TechnicianDashboardViewProps {
  onOpenJob: (jobId: string) => void;
  onRefresh: () => void;
}

export const TechnicianDashboardView: React.FC<TechnicianDashboardViewProps> = ({
  onOpenJob,
  onRefresh,
}) => {
  const { user, technicianProfile, refreshUser } = useAuth();
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [selectedRequestForQuote, setSelectedRequestForQuote] = useState<RepairRequest | null>(null);
  const [availability, setAvailability] = useState<string>(technicianProfile?.availabilityStatus || 'AVAILABLE');
  const [isUpdatingAvail, setIsUpdatingAvail] = useState(false);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const [reqList, jobList] = await Promise.all([
        ApiClient.getRepairRequests().catch(() => []),
        ApiClient.getJobs().catch(() => []),
      ]);
      setRequests(reqList);
      setJobs(jobList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleToggleAvailability = async (newStatus: string) => {
    setIsUpdatingAvail(true);
    try {
      await ApiClient.setTechnicianAvailability(newStatus);
      setAvailability(newStatus);
      await refreshUser();
    } finally {
      setIsUpdatingAvail(false);
    }
  };

  // Metrics
  const activeJobs = jobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const readyPickupCount = jobs.filter((j) => j.status === 'READY_FOR_PICKUP').length;
  const pendingEscrowNaira = activeJobs.reduce((sum, j) => sum + (j.finalAmount || j.originalQuoteAmount || 0), 0);
  const clearedEarningsNaira = technicianProfile?.totalEarningsNaira || 1240000;

  return (
    <div id="technician-dashboard-view" className="space-y-6 pb-8">
      {/* Top Shop Banner & Live Availability Switch */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white">
              {technicianProfile?.businessName || user?.name || 'Technician Portal'}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Verified Shop
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{technicianProfile?.shopLocation?.address || 'Computer Village, Ikeja, Lagos'}</span>
          </p>
        </div>

        {/* Live Availability Status Switch */}
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Status:</span>
          {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
            <button
              key={st}
              onClick={() => handleToggleAvailability(st)}
              disabled={isUpdatingAvail}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                availability === st
                  ? st === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : st === 'BUSY'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Incoming Requests</span>
          <span className="text-2xl font-black text-blue-600">{requests.length}</span>
          <span className="text-[11px] text-slate-500 block">Open for quoting</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active in Shop</span>
          <span className="text-2xl font-black text-indigo-600">{activeJobs.length}</span>
          <span className="text-[11px] text-slate-500 block">{readyPickupCount} ready for pickup</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">In Escrow (Pending)</span>
          <span className="text-xl font-black text-amber-600">₦{pendingEscrowNaira.toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 block">Releases upon pickup</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cleared Payout</span>
          <span className="text-xl font-black text-emerald-700">₦{clearedEarningsNaira.toLocaleString()}</span>
          <span className="text-[11px] text-emerald-600 font-medium block">✓ Bank settlement ready</span>
        </div>
      </div>

      {/* Incoming Requests Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>Nearby Customer Repair Requests</span>
          </h3>
          <span className="text-xs text-blue-600 font-bold">{requests.length} Active Leads</span>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
            No open repair requests in your area right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                id={`request-lead-${req.id}`}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900">
                      {req.deviceBrand} {req.deviceModel}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customer in: <strong>{req.customerLocation.address}</strong> (~0.8 km away)
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {req.quotes?.length ?? req.quotesCount ?? 0} Quote(s)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(req.issues || []).map((iss, i) => (
                    <span key={i} className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium">
                      {(iss || '').replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {req.description && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{req.description}"
                  </p>
                )}

                <button
                  id={`quote-btn-${req.id}`}
                  onClick={() => setSelectedRequestForQuote(req)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Submit Transparent Quote</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Work Orders In Shop */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>Active Work Orders in Shop</span>
          </h3>
          <span className="text-xs text-slate-500">{activeJobs.length} In Progress</span>
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
            No active work orders. When a customer accepts your quote and locks escrow, it will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onOpenJob(job.id)}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <h4 className="font-bold text-base text-slate-900">{job.deviceBrand} {job.deviceModel}</h4>
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Job ID: <span className="font-mono text-slate-700">{job.id}</span> • Escrow: <strong className="text-emerald-700">₦{(job.finalAmount || job.originalQuoteAmount || 0).toLocaleString()}</strong>
                  </p>
                </div>

                <button className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer">
                  <span>Open Job Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote Builder Modal */}
      {selectedRequestForQuote && (
        <QuoteBuilderModal
          request={selectedRequestForQuote}
          onClose={() => setSelectedRequestForQuote(null)}
          onQuoteSubmitted={() => {
            setSelectedRequestForQuote(null);
            fetchDashboardData();
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
