import React from 'react';
import { CheckCircle2, Search, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface RepairSuccessProps {
  requestId: string;
  deviceBrand: string;
  deviceModel: string;
  onFindTechnicians: () => void;
}

export const RepairSuccess: React.FC<RepairSuccessProps> = ({
  requestId,
  deviceBrand,
  deviceModel,
  onFindTechnicians,
}) => {
  const formattedReqId = requestId.replace(/^req_/, 'REQ-').toUpperCase();

  return (
    <div className="py-8 px-4 text-center space-y-6 max-w-md mx-auto animate-fadeIn">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
        <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Repair request submitted</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
          Your request for <span className="font-bold text-slate-800">{deviceBrand} {deviceModel}</span> has been logged securely on Fix Hub.
        </p>
      </div>

      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2 text-left shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Request Identifier</span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md">MATCHING</span>
        </div>
        <p className="text-base font-mono font-extrabold text-white tracking-wide">{formattedReqId}</p>
        <p className="text-[11px] text-slate-400">
          We are scanning nearby verified repair labs matching your device and issue requirements.
        </p>
      </div>

      <div className="pt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onFindTechnicians}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 cursor-pointer"
        >
          <Clock className="w-5 h-5" />
          <span>View Quotes & Escrow</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
