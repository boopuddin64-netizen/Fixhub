import React from 'react';
import { Star, ShieldCheck, Wrench, MapPin, Clock, ArrowRight, ExternalLink } from 'lucide-react';
import { TechnicianMatchResult } from '../../../types';

interface TechnicianDiscoveryCardProps {
  match: TechnicianMatchResult;
  onViewShop: () => void;
}

export const TechnicianDiscoveryCard: React.FC<TechnicianDiscoveryCardProps> = ({
  match,
  onViewShop,
}) => {
  const { technician, distanceKm, breakdown } = match;
  const rating = technician.rating || 4.8;
  const completedRepairs = technician.completedRepairs || 240;
  const isVerified = technician.isVerified ?? true;

  const handleGetDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = encodeURIComponent(`${technician.shopAddress}, ${technician.city || 'Lagos'}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all p-5 space-y-4">
      {/* Top Shop Info & Rating */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center shrink-0 shadow-sm text-lg">
            {technician.businessName ? technician.businessName.charAt(0) : 'T'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {technician.businessName}
              </h3>
              {isVerified && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
              <div className="flex items-center text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="ml-1 text-slate-800">{rating.toFixed(1)}</span>
              </div>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-500">{completedRepairs}+ repairs</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-blue-600">{distanceKm.toFixed(1)} km away</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Signals */}
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1">
          ✓ Verified Shop
        </span>
        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1">
          ✓ Warranty available
        </span>
        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1">
          ✓ {completedRepairs}+ repairs
        </span>
      </div>

      {/* Capabilities & Location */}
      <div className="space-y-2 pt-1 text-xs text-slate-600 border-t border-slate-100">
        <div className="flex items-center gap-2 pt-2">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-800 line-clamp-1">{technician.shopAddress}, {technician.area || technician.city}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-700">Open today • 9:00 AM – 6:00 PM</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleGetDirections}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>Get Directions</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={onViewShop}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
        >
          <span>View Shop</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
