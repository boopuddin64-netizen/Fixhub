import React from 'react';
import { Loader2, ShieldCheck, Search } from 'lucide-react';

export const RepairSubmitting: React.FC = () => {
  return (
    <div className="py-12 px-4 text-center space-y-6 max-w-md mx-auto animate-fadeIn">
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-30" />
        <div className="relative w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-extrabold text-slate-900">Submitting your repair request...</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
          Checking technician availability and saving your evidence securely on Fix Hub.
        </p>
      </div>

      <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-center gap-2 max-w-xs mx-auto">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Idempotent submission & secure location masking</span>
      </div>
    </div>
  );
};
