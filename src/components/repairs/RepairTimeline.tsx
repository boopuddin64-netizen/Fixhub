import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { RepairLifecycleStatus } from '../../types';

interface RepairTimelineProps {
  status: RepairLifecycleStatus | string;
}

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ status }) => {
  const steps = [
    {
      label: 'Booked',
      done: [
        'BOOKED',
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(status),
    },
    {
      label: 'Drop Off',
      done: [
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(status),
    },
    {
      label: 'Checked In',
      done: [
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(status),
    },
    {
      label: 'Diagnosis & Repair',
      done: [
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(status),
    },
    {
      label: 'Ready for Pickup',
      done: [
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(status),
    },
    {
      label: 'Picked Up',
      done: ['PICKED_UP', 'COMPLETED'].includes(status),
    },
    {
      label: 'Warranty',
      done: ['COMPLETED'].includes(status),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress Tracker</span>
        <span className="text-[10px] font-semibold text-slate-400">Fixhub Verified</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
                step.done
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-300 border border-slate-200'
              }`}
            >
              {step.done ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            </div>
            <span
              className={`text-[8px] sm:text-[9px] mt-1 leading-tight line-clamp-2 ${
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
