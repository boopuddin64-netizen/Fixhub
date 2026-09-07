import React, { useState, useEffect } from 'react';
import { Plus, Wrench, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { RepairJob, RepairRequest, TechnicianProfile } from '../../types';
import { RepairCard } from './RepairCard';
import { ActiveRepairTracker } from '../customer/ActiveRepairTracker';

interface CustomerRepairsViewProps {
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
}

export const CustomerRepairsView: React.FC<CustomerRepairsViewProps> = ({
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
}) => {
  const [filterTab, setFilterTab] = useState<'active' | 'history'>('active');

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeTechnicians = Array.isArray(technicians) ? technicians : [];

  const activeJobs = safeJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const historyJobs = safeJobs.filter((j) => j.status === 'COMPLETED' || j.status === 'CANCELLED');

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
          {activeJobs.length === 0 && activeRequests.length === 0 ? (
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
                />
              ))}

              {/* Active Requests (Looking for quotes) */}
              {activeRequests.map((req) => (
                <RepairCard
                  key={req.id}
                  type="request"
                  request={req}
                  onSelect={() => onOpenDiscovery(req.id)}
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
