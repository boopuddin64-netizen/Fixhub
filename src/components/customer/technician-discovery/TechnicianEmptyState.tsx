import React from 'react';
import { Search, MapPin, RefreshCw } from 'lucide-react';

interface TechnicianEmptyStateProps {
  onExpandSearch: () => void;
  onChangeLocation: () => void;
}

export const TechnicianEmptyState: React.FC<TechnicianEmptyStateProps> = ({
  onExpandSearch,
  onChangeLocation,
}) => {
  return (
    <div className="p-10 rounded-3xl border border-dashed border-slate-300 bg-white text-center space-y-4 max-w-md mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
        <Search className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">No technicians found nearby</h3>
        <p className="text-xs sm:text-sm text-slate-500">
          We couldn't find a suitable verified technician within your current search area. Try expanding your search radius or changing your location.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={onExpandSearch}
          className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Expand Search Area (50 km)</span>
        </button>

        <button
          type="button"
          onClick={onChangeLocation}
          className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4 text-slate-500" />
          <span>Change Location</span>
        </button>
      </div>
    </div>
  );
};
