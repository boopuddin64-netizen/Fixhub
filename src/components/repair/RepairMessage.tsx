import React from 'react';
import { Check, Edit2 } from 'lucide-react';

interface RepairMessageProps {
  title: string;
  subtitle?: string;
  summaryText: string;
  badges?: string[];
  onEdit?: () => void;
}

export const RepairMessage: React.FC<RepairMessageProps> = ({
  title,
  subtitle,
  summaryText,
  badges = [],
  onEdit,
}) => {
  return (
    <div className="bg-slate-100/90 border border-slate-200/80 rounded-2xl p-3.5 mb-3 animate-fadeIn flex items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <Check className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
            {subtitle && <span className="text-[11px] text-slate-400">• {subtitle}</span>}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate mt-0.5">{summaryText}</p>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {badges.map((b, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-medium rounded-md">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      )}
    </div>
  );
};
