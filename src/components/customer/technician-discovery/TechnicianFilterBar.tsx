import React from 'react';
import { SlidersHorizontal, CheckCircle2, MapPin, Tag, ArrowUpDown } from 'lucide-react';

export type PriceTier = 'all' | 'budget' | 'mid' | 'premium';
export type SortOption = 'recommended' | 'nearest' | 'rating' | 'price_low';

interface TechnicianFilterBarProps {
  maxDistance: number;
  onChangeMaxDistance: (dist: number) => void;
  priceTier: PriceTier;
  onChangePriceTier: (tier: PriceTier) => void;
  verifiedOnly: boolean;
  onChangeVerifiedOnly: (val: boolean) => void;
  sortBy: SortOption;
  onChangeSortBy: (sort: SortOption) => void;
  totalCount: number;
  currentLocationName?: string;
  onEditLocation?: () => void;
}

export const TechnicianFilterBar: React.FC<TechnicianFilterBarProps> = ({
  maxDistance,
  onChangeMaxDistance,
  priceTier,
  onChangePriceTier,
  verifiedOnly,
  onChangeVerifiedOnly,
  sortBy,
  onChangeSortBy,
  totalCount,
  currentLocationName,
  onEditLocation,
}) => {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3.5">
      {/* Top Header & Sort Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-extrabold text-slate-900 tracking-tight block">
              Filter Shops ({totalCount} found)
            </span>
            {currentLocationName && (
              <button
                type="button"
                onClick={onEditLocation}
                className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium cursor-pointer transition-colors text-left"
                title="Click to edit location"
              >
                <MapPin className="w-3 h-3 text-slate-400" />
                <span className="truncate max-w-[180px] sm:max-w-xs">{currentLocationName}</span>
                <span className="text-blue-600 font-bold ml-0.5">Change</span>
              </button>
            )}
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => onChangeSortBy('recommended')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'recommended' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Best Match
          </button>
          <button
            type="button"
            onClick={() => onChangeSortBy('nearest')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'nearest' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Nearest
          </button>
          <button
            type="button"
            onClick={() => onChangeSortBy('rating')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'rating' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Top Rated
          </button>
          <button
            type="button"
            onClick={() => onChangeSortBy('price_low')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'price_low' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Price: Low
          </button>
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
        {/* Distance Range */}
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
          <span className="text-slate-500 font-bold shrink-0">Distance:</span>
          <select
            value={maxDistance}
            onChange={(e) => onChangeMaxDistance(Number(e.target.value))}
            className="w-full bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
          >
            <option value={5}>Within 5 km</option>
            <option value={10}>Within 10 km</option>
            <option value={25}>Within 25 km</option>
            <option value={50}>Within 50 km</option>
            <option value={0}>All distances</option>
          </select>
        </div>

        {/* Price Tier */}
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1">
            <Tag className="w-3 h-3 text-slate-400" />
            Price:
          </span>
          <select
            value={priceTier}
            onChange={(e) => onChangePriceTier(e.target.value as PriceTier)}
            className="w-full bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
          >
            <option value="all">All Prices</option>
            <option value="budget">Budget (&lt; ₦25,000)</option>
            <option value="mid">Standard (₦25k – ₦50k)</option>
            <option value="premium">Premium (&gt; ₦50,000)</option>
          </select>
        </div>

        {/* Verified Only Toggle */}
        <label className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 cursor-pointer font-bold text-slate-700 select-none hover:bg-slate-100/80 transition-colors">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Verified only
          </span>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => onChangeVerifiedOnly(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 ml-auto sm:ml-2"
          />
        </label>
      </div>
    </div>
  );
};
