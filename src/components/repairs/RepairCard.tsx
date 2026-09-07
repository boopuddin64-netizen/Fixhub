import React from 'react';
import { Smartphone, Wrench, ChevronRight, MessageSquare, ShieldCheck, MapPin, Search } from 'lucide-react';
import { RepairJob, RepairRequest } from '../../types';
import { RepairStatus } from './RepairStatus';
import { RepairTimeline } from './RepairTimeline';

interface RepairCardProps {
  type: 'job' | 'request';
  job?: RepairJob;
  request?: RepairRequest;
  onSelect: () => void;
  onOpenChat?: () => void;
}

export const RepairCard: React.FC<RepairCardProps> = ({
  type,
  job,
  request,
  onSelect,
  onOpenChat,
}) => {
  const isJob = type === 'job' && job;
  const isRequest = type === 'request' && request;

  const deviceBrand = isJob ? job.deviceBrand : request?.deviceBrand || '';
  const deviceModel = isJob ? job.deviceModel : request?.deviceModel || '';
  const status = isJob ? job.status : request?.status || 'SUBMITTED';
  const id = isJob ? job.id : request?.id || '';
  const formattedId = id.startsWith('req_')
    ? id.replace(/^req_/, 'REQ-').toUpperCase()
    : id.startsWith('job_')
    ? id.replace(/^job_/, 'JOB-').toUpperCase()
    : id.toUpperCase();

  const timestamp = isJob
    ? job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Active'
    : request?.submittedAt || request?.createdAt
    ? new Date(request.submittedAt || request.createdAt).toLocaleDateString()
    : 'Recent';

  const issuesList = isJob
    ? [job.agreedRepairIssue || 'Phone Repair']
    : request?.issues && request.issues.length > 0
    ? request.issues
    : ['Device Repair'];

  const descriptionText = isJob
    ? job.intakeNotes
    : request?.description || request?.otherDescription || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all p-4 space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">{deviceBrand} {deviceModel}</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              ID: <span className="font-bold text-slate-700">{formattedId}</span> • {timestamp}
            </p>
          </div>
        </div>
        <RepairStatus status={status} size="sm" />
      </div>

      {/* Issue Badges & Description */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {issuesList.map((issue, idx) => (
            <span
              key={idx}
              className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-semibold rounded-md flex items-center gap-1"
            >
              <Wrench className="w-3 h-3 text-amber-600" />
              {issue}
            </span>
          ))}
        </div>
        {descriptionText && (
          <p className="text-xs text-slate-600 line-clamp-2 italic">
            "{descriptionText}"
          </p>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="pt-2 border-t border-slate-100">
        <RepairTimeline status={status} />
      </div>

      {/* Footer & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          {isJob ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              ₦{job.totalAmountNaira.toLocaleString()}
            </span>
          ) : isRequest ? (
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
              {request.quotesCount || request.quotes?.length || 0} Quotes Received
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isJob && onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Chat with Technician"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onSelect}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>{isJob ? 'Track Repair' : 'Find Technicians'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
