import React from 'react';
import { LocationSelector } from '../customer/repair-flow/LocationSelector';
import { LocationCoordinates } from '../../types';

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
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Set your location
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Provide your location so we can match you with nearby verified repair shops.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs">
        <LocationSelector location={location} onChange={onChangeLocation} />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          disabled={!isLocationValid}
          onClick={onContinue}
          className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
        >
          Confirm location →
        </button>
      </div>
    </div>
  );
};
