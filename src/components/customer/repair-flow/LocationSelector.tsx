import React, { useState } from 'react';
import { LocationCoordinates } from '../../../types';
import { searchNigerianLocations, NigerianArea, POPULAR_NIGERIAN_LOCATIONS } from '../../../data/nigerianLocations';
import { MapPin, Navigation, Search, Check, AlertCircle, RefreshCw } from 'lucide-react';

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
        
        // Find nearest predefined area in POPULAR_NIGERIAN_LOCATIONS for mock reverse-geocoding
        let nearestArea: NigerianArea | null = null;
        let minDistance = Infinity;
        for (const loc of POPULAR_NIGERIAN_LOCATIONS) {
          const d = Math.sqrt(Math.pow(loc.lat - pos.coords.latitude, 2) + Math.pow(loc.lng - pos.coords.longitude, 2));
          if (d < minDistance) {
            minDistance = d;
            nearestArea = loc;
          }
        }

        // Reverse geocoding succeeds if we are close to a known hub (within 0.15 degrees)
        const geocodeSuccess = nearestArea != null && minDistance < 0.15;

        const reversedAddress = geocodeSuccess
          ? `${nearestArea.name}, ${nearestArea.city}`
          : 'GPS Coordinates (Address Unresolved)';
        const reversedArea = geocodeSuccess ? nearestArea.name : '';
        const reversedCity = geocodeSuccess ? nearestArea.city : '';
        const reversedState = geocodeSuccess ? nearestArea.state : '';

        // Auto-open manual fields for user enrichment if geocoding failed
        if (!geocodeSuccess) {
          setIsManualInput(true);
        }

        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: reversedAddress,
          landmark: geocodeSuccess ? nearestArea.landmark : 'GPS Coordinates',
          area: reversedArea,
          city: reversedCity,
          state: reversedState,
          accuracyMeters: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
          capturedAt: new Date(pos.timestamp).toISOString(),
          country: 'Nigeria',
          source: 'GPS',
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        setLocationError('Unable to access your current location. You can enter your location manually.');
      },
      { timeout: 8000, enableHighAccuracy: true }
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
      country: 'Nigeria',
      source: 'GEOCODED',
    });
    setSearchQuery('');
  };

  const updateManualField = (fields: Partial<LocationCoordinates>) => {
    const updated: LocationCoordinates = {
      lat: location?.lat ?? 0,
      lng: location?.lng ?? 0,
      address: location?.address || '',
      area: location?.area || '',
      city: location?.city || '',
      state: location?.state || '',
      landmark: location?.landmark,
      country: 'Nigeria',
      source: location?.source === 'GPS' ? 'GPS' : 'MANUAL',
      ...fields,
    };

    // If there were no coordinates, attempt simple geocoding based on city/area name match in our database
    if (updated.lat === 0 && updated.lng === 0) {
      const matchedArea = searchNigerianLocations(updated.city || updated.area || updated.state)[0];
      if (matchedArea) {
        updated.lat = matchedArea.lat;
        updated.lng = matchedArea.lng;
        updated.source = 'GEOCODED';
        if (!updated.state) updated.state = matchedArea.state;
      } else {
        updated.source = 'MANUAL';
      }
    }

    onChange(updated);
  };

  const hasLocation = Boolean(
    location &&
      (location.address || location.area || location.city) &&
      location.lat !== undefined
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
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  {location.source === 'GPS' ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      Live GPS Location Detected
                    </span>
                  ) : location.source === 'DEVELOPMENT_FALLBACK' ? (
                    <span className="text-amber-700 font-extrabold text-[10px]">
                      ⚠️ DEVELOPMENT FALLBACK ONLY
                    </span>
                  ) : location.source === 'GEOCODED' ? (
                    <span className="text-blue-700">Geocoded Location Match</span>
                  ) : (
                    <span className="text-slate-700">Manual Location Entered</span>
                  )}
                </span>
                <p className="text-sm font-black text-slate-900 leading-snug">
                  {location.address || location.area || `${location.city}, ${location.state}`}
                </p>
                <p className="text-xs text-slate-600">
                  {[location.city, location.state].filter(Boolean).join(', ')}{' '}
                  {location.landmark ? `(near ${location.landmark})` : ''}
                </p>
                {location.source === 'GPS' && location.accuracyMeters && (
                  <p className="text-[10px] font-bold text-emerald-800 bg-emerald-100/50 px-2 py-0.5 rounded-md inline-block">
                    Accuracy: ±{Math.round(location.accuracyMeters)} m
                  </p>
                )}
                {location.source === 'GPS' && !location.city && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1 mt-2 font-medium">
                    <p className="font-extrabold flex items-center gap-1 text-amber-950">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Address Unresolved</span>
                    </p>
                    <p>
                      We detected your GPS coordinates, but could not resolve a city/state address. Please enter your street address, city, and state in the manual fields below to complete matches.
                    </p>
                  </div>
                )}
                {location.source === 'DEVELOPMENT_FALLBACK' && (
                  <p className="text-[10px] text-amber-800 bg-amber-100/50 px-2 py-0.5 rounded-md inline-block font-medium">
                    Test Coordinates (Port Harcourt, Rivers State)
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange({
                  lat: 0,
                  lng: 0,
                  address: '',
                  city: '',
                  state: '',
                  source: undefined,
                });
                setLocationError(null);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 cursor-pointer shrink-0"
            >
              Change Location
            </button>
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
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <Navigation className={`w-4 h-4 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Detecting your coordinates...' : 'Use my current location'}</span>
        </button>

        {locationError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-amber-950">GPS Access Blocked or Restricted</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Your browser restricts live GPS detection when running inside an <strong>embedded iframe preview</strong>. 
                </p>
                <div className="p-2.5 bg-white/70 border border-amber-100 rounded-lg text-[10px] text-slate-700 leading-relaxed space-y-1">
                  <p className="font-bold text-slate-800">To resolve this and use Live Geolocation:</p>
                  <p>1. Click the <strong>"Open in New Tab"</strong> button in the top right header of the preview window.</p>
                  <p>2. Grant location access when prompted by your browser.</p>
                </div>
                <p className="text-[11px] text-amber-800 pt-1">
                  Alternatively, you can select one of our popular pre-seeded <strong>Repair Hubs & Markets</strong> below with 1 click to test certified technician matching instantly!
                </p>
              </div>
            </div>
            
            {/* Quick Button for Rivers State Development Fallback */}
            <button
              type="button"
              onClick={() => {
                onChange({
                  lat: 4.8156,
                  lng: 7.0498,
                  address: 'Aba Road, Garrison, Port Harcourt',
                  landmark: 'Garrison Junction (DEVELOPMENT FALLBACK ONLY)',
                  area: 'Garrison',
                  city: 'Port Harcourt',
                  state: 'Rivers State',
                  country: 'Nigeria',
                  source: 'DEVELOPMENT_FALLBACK',
                  accuracyMeters: 50,
                });
                setLocationError(null);
              }}
              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 text-[11px] font-bold rounded-lg border border-dashed border-blue-300 transition-all cursor-pointer"
            >
              Use Rivers State Fallback (Port Harcourt) [DEMO ONLY]
            </button>
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
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer bg-transparent border-none"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
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
            className="text-xs font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer bg-transparent border-none"
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
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    value={location?.state || ''}
                    onChange={(e) => updateManualField({ state: e.target.value })}
                    placeholder="e.g. Rivers State"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
