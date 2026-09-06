import React, { useState } from 'react';
import { LocationCoordinates } from '../../../types';
import { searchNigerianLocations, NigerianArea } from '../../../data/nigerianLocations';
import { MapPin, Navigation, Search, Check, AlertCircle } from 'lucide-react';

interface LocationSelectorProps {
  location?: LocationCoordinates | null;
  onChange: (newLoc: LocationCoordinates) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  location,
  onChange,
}) => {
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState<boolean>(false);

  // Search results
  const searchResults = searchNigerianLocations(searchQuery);

  const handleUseCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: location?.address || 'Current GPS Location',
          landmark: location?.landmark || 'Detected GPS Location',
          area: location?.area || 'Current Location',
          city: location?.city || '',
          state: location?.state || '',
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        setLocationError('Could not access current GPS location. Please select your area below.');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const handleSelectArea = (area: NigerianArea) => {
    onChange({
      lat: area.lat,
      lng: area.lng,
      address: `${area.name}, ${area.city}`,
      landmark: area.landmark,
      area: area.name,
      city: area.city,
      state: area.state,
    });
    setSearchQuery('');
  };

  const updateManualField = (fields: Partial<LocationCoordinates>) => {
    const updated: LocationCoordinates = {
      lat: location?.lat,
      lng: location?.lng,
      address: location?.address || '',
      area: location?.area || '',
      city: location?.city || '',
      state: location?.state || '',
      landmark: location?.landmark,
      ...fields,
    };

    // If lat/lng are missing, check if updated city/area matches a known Nigerian location
    if (updated.lat === undefined || updated.lng === undefined) {
      const matchedArea = searchNigerianLocations(updated.city || updated.area || updated.state)[0];
      if (matchedArea) {
        updated.lat = matchedArea.lat;
        updated.lng = matchedArea.lng;
        if (!updated.state) updated.state = matchedArea.state;
      }
    }

    onChange(updated);
  };

  const hasLocation = Boolean(
    location &&
      (location.address || location.area || location.city) &&
      (location.lat !== undefined || location.area || location.city)
  );

  return (
    <div id="repair-location-selector" className="space-y-4">
      {/* Active Selected Location Display Card */}
      {hasLocation && location ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Selected Location for Matching
                </span>
                <p className="text-sm font-black text-slate-900 leading-snug">
                  {location.address || location.area || `${location.city}, ${location.state}`}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {[location.city, location.state].filter(Boolean).join(', ')}{' '}
                  {location.landmark ? `(near ${location.landmark})` : ''}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-bold shrink-0">
              Selected
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
          <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No Location Selected Yet</p>
          <p className="text-[11px] text-slate-500">
            Choose your area below or use your current location to discover certified technicians nearby.
          </p>
        </div>
      )}

      {/* Option A: Use Current Location */}
      <div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Navigation className={`w-4 h-4 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Detecting your coordinates...' : 'Use my current location'}</span>
        </button>

        {locationError && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{locationError}</span>
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-200 w-full" />
        <span className="bg-slate-50 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          Or select your area
        </span>
      </div>

      {/* Option B: Search Area / Landmark */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search state, city or area (e.g. Ikeja, Lekki, Wuse, Garrison)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Popular Tech Hubs Quick Chips */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Popular Repair Hubs & Markets
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {searchResults.map((area, idx) => {
              const isSelected =
                location != null &&
                ((location.lat === area.lat && location.lng === area.lng) ||
                  (location.area === area.name && location.city === area.city));
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectArea(area)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {area.name}
                      </p>
                      {area.isTechHub && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold shrink-0">
                          Tech Hub
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {area.city}, {area.state}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Toggle Manual Form Input */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsManualInput(!isManualInput)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
          >
            {isManualInput ? 'Hide manual address fields' : 'Enter custom street / landmark'}
          </button>

          {isManualInput && (
            <div className="mt-3 p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs animate-fadeIn">
              <div>
                <label className="text-[11px] font-bold text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={location?.address || ''}
                  onChange={(e) => updateManualField({ address: e.target.value })}
                  placeholder="e.g. 14 Aba Road"
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">City / LGA</label>
                  <input
                    type="text"
                    value={location?.city || ''}
                    onChange={(e) => updateManualField({ city: e.target.value })}
                    placeholder="e.g. Port Harcourt"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    value={location?.state || ''}
                    onChange={(e) => updateManualField({ state: e.target.value })}
                    placeholder="e.g. Rivers State"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700">Nearest Landmark (optional)</label>
                <input
                  type="text"
                  value={location?.landmark || ''}
                  onChange={(e) => updateManualField({ landmark: e.target.value })}
                  placeholder="e.g. Near Garrison Junction"
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
