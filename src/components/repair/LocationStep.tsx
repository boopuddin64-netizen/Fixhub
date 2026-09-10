import React from 'react';
import { LocationSelector } from '../customer/repair-flow/LocationSelector';
import { LocationCoordinates } from '../../types';
import { MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LocationStepProps {
  location: LocationCoordinates | null;
  onChangeLocation: (location: LocationCoordinates | null) => void;
  onContinue: () => void;
}

export const LocationStep: React.FC<LocationStepProps> = ({
  location,
  onChangeLocation,
  onContinue,
}) => {
  const isLocationValid = Boolean(
    location &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      (location.lat !== 0 || location.lng !== 0) &&
      (location.address || location.area || location.city || location.source === 'GPS' || location.source === 'GEOCODED')
  );

  return (
    <div className="space-y-3.5 animate-fadeIn">
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <LocationSelector location={location} onChange={onChangeLocation} />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs">
            {isLocationValid ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {location?.area || location?.city || location?.address ? 'Location set' : 'GPS coordinates detected'}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">Search an area, tech hub, or use GPS</span>
            )}
          </div>

          <button
            type="button"
            disabled={!isLocationValid}
            onClick={onContinue}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Confirm Location</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
