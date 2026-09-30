import React, { useState, useEffect } from 'react';
import { Plus, Wrench, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { RepairJob, RepairRequest, TechnicianProfile } from '../../types';
import { RepairCard } from './RepairCard';
import { ActiveRepairTracker } from '../customer/ActiveRepairTracker';
import { isHistoryStatus } from '../../utils/repairTimeline';

interface CustomerRepairsViewProps {
  /** first load of jobs/requests still in flight: show skeleton cards instead of the empty state */
  loading?: boolean;
  jobs: RepairJob[];
  requests: RepairRequest[];
  technicians: TechnicianProfile[];
  selectedJobId?: string | null;
  onSelectJob: (jobId: string | null) => void;
  onOpenDiscovery: (requestId: string) => void;
  onStartNewRepair: () => void;
  onOpenChat: () => void;
  onOpenReviewModal: () => void;
  onRefresh: () => void;
  onPay?: (job: RepairJob) => void;
}

export const CustomerRepairsView: React.FC<CustomerRepairsViewProps> = ({
  loading = false,
  jobs,
  requests,
  technicians,
  selectedJobId,
  onSelectJob,
  onOpenDiscovery,
  onStartNewRepair,
  onOpenChat,
  onOpenReviewModal,
  onRefresh,
  onPay,
}) => {
  const [filterTab, setFilterTab] = useState<'active' | 'history'>('active');
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeTechnicians = Array.isArray(technicians) ? technicians : [];

  const handleCancelRequest = (requestId: string) => {
    // Cancelling is irreversible: always ask first
    setActionError(null);
    setConfirmCancelId(requestId);
  };

  const confirmCancelRequest = async () => {
    const requestId = confirmCancelId;
    if (!requestId) return;
    setCancellingRequestId(requestId);
    try {
      await ApiClient.cancelRequest(requestId);
      setConfirmCancelId(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Could not cancel this request. Check your connection and try again.');
    } finally {
      setCancellingRequestId(null);
    }
  };

  const activeJobs = safeJobs.filter((j) => !isHistoryStatus(j.status));
  const historyJobs = safeJobs.filter((j) => isHistoryStatus(j.status));

  const activeRequests = safeRequests.filter(
    (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED'
  );

  const selectedJob = safeJobs.find((j) => j.id === selectedJobId) || activeJobs[0];
  const selectedJobTech = selectedJob
    ? safeTechnicians.find((t) => t.userId === selectedJob.technicianId)
    : null;

  // If a specific job is selected for deep tracking
  if (selectedJobId && selectedJob) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectJob(null)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            ← Back to All Repairs
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <ActiveRepairTracker
          job={selectedJob}
          technician={selectedJobTech}
          onOpenChat={onOpenChat}
          onRefresh={onRefresh}
          onOpenReviewModal={onOpenReviewModal}
          onPay={onPay}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Your Phone Repairs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track live repair status, inspect quotes, and review warranties
          </p>
        </div>
        <button
          type="button"
          onClick={onStartNewRepair}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-2xl shadow-md shadow-blue-600/20 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Repair</span>
        </button>
      </div>

      {actionError && !confirmCancelId && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{actionError}</div>
      )}

      {confirmCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-request-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <h3 id="cancel-request-title" className="text-base font-extrabold text-slate-900">Cancel this repair request?</h3>
            <p className="text-xs text-slate-600">Technicians will stop quoting and any quotes you received will be discarded. You can always post a new request.</p>
            {actionError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{actionError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setConfirmCancelId(null); setActionError(null); }} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">Keep request</button>
              <button type="button" onClick={confirmCancelRequest} disabled={cancellingRequestId === confirmCancelId} className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60 cursor-pointer">
                {cancellingRequestId === confirmCancelId ? 'Cancelling…' : 'Yes, cancel request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setFilterTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterTab === 'active'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Active Repairs ({activeJobs.length + activeRequests.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed & History ({historyJobs.length})</span>
        </button>
      </div>

      {/* Content List */}
      {filterTab === 'active' ? (
        <div className="space-y-4">
          {loading && activeJobs.length === 0 && activeRequests.length === 0 ? (
            <div role="status" aria-label="Loading your repairs" className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="h-4 w-1/2 rounded bg-slate-200" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                  <div className="h-8 w-full rounded bg-slate-100" />
                </div>
              ))}
              <span className="sr-only">Loading your repairs…</span>
            </div>
          ) : activeJobs.length === 0 && activeRequests.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-slate-300 bg-white text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No active phone repairs</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Have a cracked screen, faulty battery, or water damage? Book a verified local technician now.
              </p>
              <button
                type="button"
                onClick={onStartNewRepair}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Book a Phone Repair</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Jobs (In Progress) */}
              {activeJobs.map((job) => (
                <RepairCard
                  key={job.id}
                  type="job"
                  job={job}
                  onSelect={() => onSelectJob(job.id)}
                  onOpenChat={onOpenChat}
                  onPay={onPay}
                />
              ))}

              {/* Active Requests (Looking for quotes) */}
              {activeRequests.map((req) => (
                <RepairCard
                  key={req.id}
                  type="request"
                  request={req}
                  onSelect={() => onOpenDiscovery(req.id)}
                  onCancelRequest={handleCancelRequest}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {historyJobs.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-slate-300 bg-white text-center space-y-2">
              <p className="text-xs text-slate-500 font-medium">No past repair history found.</p>
            </div>
          ) : (
            historyJobs.map((job) => (
              <RepairCard
                key={job.id}
                type="job"
                job={job}
                onSelect={() => onSelectJob(job.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
