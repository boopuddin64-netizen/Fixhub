import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { RepairLifecycleStatus } from '../../types';

interface RepairTimelineProps {
  status: RepairLifecycleStatus | string;
}

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ status }) => {
  const steps = [
    {
      label: 'Submitted & Matching',
      done: [
        'SUBMITTED',
        'MATCHING',
        'TECHNICIANS_FOUND',
        'REQUESTED',
        'QUOTING',
        'QUOTE_RECEIVED',
        'QUOTE_ACCEPTED',
        'PAYMENT_PENDING',
        'PAYMENT_CONFIRMED',
        'BOOKED',
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'IN_REPAIR',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REPAIR_COMPLETED',
      ].includes(status),
    },
    {
      label: 'Quote & Payment',
      done: [
        'QUOTE_ACCEPTED',
        'PAYMENT_PENDING',
        'PAYMENT_CONFIRMED',
        'BOOKED',
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'IN_REPAIR',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REPAIR_COMPLETED',
      ].includes(status),
    },
    {
      label: 'Intake & Diagnostics',
      done: [
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'IN_REPAIR',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REPAIR_COMPLETED',
      ].includes(status),
    },
    {
      label: 'In Repair',
      done: [
        'IN_REPAIR',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REPAIR_COMPLETED',
      ].includes(status),
    },
    {
      label: 'Completed & Warranty',
      done: ['COMPLETED', 'REPAIR_COMPLETED'].includes(status),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress Timeline</span>
        <span className="text-[10px] font-semibold text-slate-400">Real Backend Status</span>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                step.done
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-300 border border-slate-200'
              }`}
            >
              {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
            </div>
            <span
              className={`text-[9px] mt-1 leading-tight line-clamp-2 ${
                step.done ? 'font-bold text-slate-800' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
