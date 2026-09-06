import React, { useEffect, useState } from 'react';
import { Smartphone, MapPin, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface TechnicianRadarHandoffProps {
  deviceBrand: string;
  deviceModel: string;
  problemSummary: string;
  locationSummary: string;
  onViewQuotes: () => void;
}

export const TechnicianRadarHandoff: React.FC<TechnicianRadarHandoffProps> = ({
  deviceBrand,
  deviceModel,
  problemSummary,
  locationSummary,
  onViewQuotes,
}) => {
  const [matchCount, setMatchCount] = useState<number>(1);
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    const t1 = setTimeout(() => setMatchCount(3), 800);
    const t2 = setTimeout(() => setMatchCount(6), 1600);
    const t3 = setTimeout(() => setMatchCount(8), 2400);

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(timer);
    };
  }, []);

  return (
    <div id="technician-radar-handoff" className="py-8 px-4 text-center space-y-6 max-w-md mx-auto animate-fadeIn">
      {/* Animated Radar Pulse Effect */}
      <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
        {/* Outer Ripple Rings */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping opacity-75" />
        <div className="absolute -inset-4 rounded-full border border-emerald-400/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-emerald-500/10" />

        {/* Central Core */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-600/30">
          <Smartphone className="w-8 h-8 text-white animate-bounce" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
          <span>Searching nearby verified shops...</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Broadcasting to Technicians
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
          We found <strong className="text-emerald-700 font-bold">{matchCount} verified repairers</strong> near {locationSummary} with genuine parts in stock.
        </p>
      </div>

      {/* Request Details Card */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device</span>
          <span className="text-xs font-black text-slate-900">{deviceBrand} {deviceModel}</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Problem</span>
          <span className="text-xs font-bold text-emerald-800 truncate max-w-[200px]">{problemSummary}</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</span>
          <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{locationSummary}</span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Privacy & Trust</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified Technicians Only
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onViewQuotes}
          className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>View incoming quotes</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-slate-400">
          Quotes typically arrive within 3 to 5 minutes.
        </p>
      </div>
    </div>
  );
};
