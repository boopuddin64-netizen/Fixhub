import React from 'react';
import { ArrowLeft, Star, ShieldCheck, MapPin, Clock, ExternalLink, Wrench, CheckCircle2 } from 'lucide-react';
import { TechnicianMatchResult } from '../../../types';

interface TechnicianDetailsViewProps {
  match: TechnicianMatchResult;
  onBack: () => void;
  customerLocation?: { lat?: number; lng?: number; address?: string };
}

export const TechnicianDetailsView: React.FC<TechnicianDetailsViewProps> = ({
  match,
  onBack,
  customerLocation,
}) => {
  const { technician, distanceKm } = match;
  const rating = technician.rating || 4.8;
  const completedRepairs = technician.completedRepairs || 240;
  const isVerified = technician.isVerified ?? true;

  const handleGetDirections = () => {
    const origin =
      customerLocation?.lat && customerLocation?.lng
        ? `${customerLocation.lat},${customerLocation.lng}`
        : encodeURIComponent(customerLocation?.address || '');

    const destLat = technician.shopLocation?.lat;
    const destLng = technician.shopLocation?.lng;
    const destination =
      destLat && destLng
        ? `${destLat},${destLng}`
        : encodeURIComponent(`${technician.shopAddress}, ${technician.city || 'Port Harcourt'}`);

    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Nearby Technicians</span>
        </button>
      </div>

      {/* Shop Profile Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-2xl shrink-0 shadow-md">
            {technician.businessName ? technician.businessName.charAt(0) : 'T'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{technician.businessName}</h2>
              {isVerified && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-bold rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Verified Repair Shop
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Managed by {technician.name}</p>
            <div className="flex items-center gap-2 pt-1 text-xs font-medium text-slate-700">
              <div className="flex items-center text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span className="ml-1 text-slate-900">{rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal ml-1">— Excellent</span>
              </div>
              <span>•</span>
              <span>{completedRepairs}+ repairs completed</span>
              <span>•</span>
              <span className="font-bold text-blue-600">{distanceKm.toFixed(1)} km away</span>
            </div>
          </div>
        </div>
      </div>

      {/* Location & Shop Address */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Shop Location & Directions</h3>
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{technician.shopAddress}</p>
            {technician.landmark && (
              <p className="text-xs text-slate-500">Landmark: {technician.landmark}</p>
            )}
            <p className="text-xs text-slate-600 font-medium">
              {technician.area ? `${technician.area}, ` : ''}{technician.city}, {technician.state}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGetDirections}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Get Directions in Maps</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Capabilities & Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Supported Brands & Services</h3>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(technician.supportedBrands || ['Apple', 'Samsung', 'Infinix', 'Tecno', 'Xiaomi']).map((brand, idx) => (
              <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg">
                {brand}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 pt-2">
            ✓ Screen Repair • Battery Replacement • Charging Port • Water Damage Restoration
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Operating Hours & Warranty</h3>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="font-semibold">Monday – Saturday</span>
              <span className="font-bold text-slate-900">9:00 AM – 6:00 PM</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="font-semibold">Sunday</span>
              <span className="font-bold text-emerald-600">Closed (Emergency drop-off available)</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Fix Hub Verified Warranty Available on All Repairs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
