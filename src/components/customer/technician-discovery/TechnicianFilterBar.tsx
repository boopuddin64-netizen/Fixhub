import React from 'react';
import { SlidersHorizontal, CheckCircle2, Star } from 'lucide-react';

interface TechnicianFilterBarProps {
  maxDistance: number;
  onChangeMaxDistance: (dist: number) => void;
  verifiedOnly: boolean;
  onChangeVerifiedOnly: (val: boolean) => void;
  sortBy: 'recommended' | 'nearest' | 'rating';
  onChangeSortBy: (sort: 'recommended' | 'nearest' | 'rating') => void;
  totalCount: number;
}

export const TechnicianFilterBar: React.FC<TechnicianFilterBarProps> = ({
  maxDistance,
  onChangeMaxDistance,
  verifiedOnly,
  onChangeVerifiedOnly,
  sortBy,
  onChangeSortBy,
  totalCount,
}) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Filters & Sorting ({totalCount} found)
          </span>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => onChangeSortBy('recommended')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'recommended' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Recommended
          </button>
          <button
            type="button"
            onClick={() => onChangeSortBy('nearest')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'nearest' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Nearest
          </button>
          <button
            type="button"
            onClick={() => onChangeSortBy('rating')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              sortBy === 'rating' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Top Rated
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-100 text-xs">
        {/* Distance Range */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Max Distance:</span>
          <select
            value={maxDistance}
            onChange={(e) => onChangeMaxDistance(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value={5}>Within 5 km</option>
            <option value={10}>Within 10 km</option>
            <option value={25}>Within 25 km</option>
            <option value={50}>Within 50 km</option>
          </select>
        </div>

        {/* Verified Only Toggle */}
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => onChangeVerifiedOnly(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
          />
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified only
          </span>
        </label>
      </div>
    </div>
  );
};
