import React from 'react';
import { AlertTriangle, Ban, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { RepairLifecycleStatus } from '../../types';
import { computeTimeline } from '../../utils/repairTimeline';
import { formatDateTime } from '../../utils/format';

interface RepairTimelineProps {
  status: RepairLifecycleStatus | string;
  statusHistory?: { status: string; timestamp: string }[];
}

const TERMINAL_STYLE = {
  DISPUTED: { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle, text: 'Dispute under Fixhub review — payment is held safely' },
  CANCELLED: { cls: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Ban, text: 'This repair was cancelled' },
  REFUNDED: { cls: 'bg-violet-50 text-violet-800 border-violet-200', Icon: RotateCcw, text: 'Payment refunded to the customer' },
} as const;

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ status, statusHistory }) => {
  const t = computeTimeline(status, statusHistory);
  const term = t.terminal ? TERMINAL_STYLE[t.terminal] : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress Tracker</span>
        <span className="text-[10px] font-semibold text-slate-500">{t.summary}</span>
      </div>
      {term && (
        <div role="status" className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${term.cls}`}>
          <term.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {term.text}
        </div>
      )}
      <ol className="grid grid-cols-7 gap-1 text-center" aria-label={`Repair progress: ${t.summary}`}>
        {t.steps.map((step) => (
          <li key={step.key} className="flex flex-col items-center" aria-current={step.state === 'current' ? 'step' : undefined} title={step.at ? `${step.label} — ${formatDateTime(step.at)}` : step.label}>
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
                step.state === 'done'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : step.state === 'current'
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              {step.state === 'done' ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" /> : <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" aria-hidden="true" />}
            </div>
            <span className={`text-[9px] mt-1 leading-tight line-clamp-2 ${step.state === 'done' ? 'font-bold text-slate-800' : step.state === 'current' ? 'font-bold text-blue-700' : 'text-slate-500'}`}>
              {step.label}
            </span>
            <span className="sr-only">{step.state === 'done' ? 'completed' : step.state === 'current' ? 'in progress' : 'not started'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};
