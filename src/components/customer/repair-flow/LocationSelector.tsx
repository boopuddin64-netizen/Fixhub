import React, { useState } from 'react';
import { LocationCoordinates } from '../../../types';
import { searchNigerianLocations, NigerianArea, POPULAR_NIGERIAN_LOCATIONS } from '../../../data/nigerianLocations';
import { reverseGeocode } from '../../../utils/reverseGeocoding';
import { MapPin, Navigation, Search, Check, AlertCircle, ExternalLink, RefreshCw, Compass, Globe } from 'lucide-react';
import { useGoogleMaps } from '../../maps/GoogleMapsProvider';
import { GooglePlaceAutocomplete } from '../../maps/GooglePlaceAutocomplete';
import { InteractiveLocationMap } from '../../maps/InteractiveLocationMap';

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
  const [iframeBlocked, setIframeBlocked] = useState<boolean>(false);
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const { hasKey } = useGoogleMaps();

  const isDev = Boolean((import.meta as any).env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'));
  const searchResults = searchNigerianLocations(searchQuery);

  const handleUseCurrentLocation = () => {
    setLocationError(null);
    setIframeBlocked(false);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setIframeBlocked(true);
      setLocationError('Live location is unavailable in this preview.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);

        // 1. Authoritative real GPS coordinates from device
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const timestampIso = new Date(pos.timestamp).toISOString();

        // 2. Reverse geocoding attempt
        const geocodeResult = await reverseGeocode(rawLat, rawLng);

        if (geocodeResult.resolved && geocodeResult.location) {
          const loc = geocodeResult.location;
          onChange({
            lat: rawLat,
            lng: rawLng,
            address: loc.address || `${loc.street || ''} ${loc.city || ''}`.trim(),
            landmark: loc.landmark,
            area: loc.area || loc.city || '',
            city: loc.city || '',
            state: loc.state || '',
            country: loc.country || 'Nigeria',
            accuracyMeters: accuracy,
            timestamp: timestampIso,
            capturedAt: timestampIso,
            source: 'GPS',
          });
        } else {
          // Geocoding failed: DO NOT fabricate or invent a city/state!
          // Retain authoritative coordinates, accuracy, timestamp, source = "GPS"
          setIsManualInput(true);
          onChange({
            lat: rawLat,
            lng: rawLng,
            address: '',
            landmark: undefined,
            area: '',
            city: '',
            state: '',
            country: 'Nigeria',
            accuracyMeters: accuracy,
            timestamp: timestampIso,
            capturedAt: timestampIso,
            source: 'GPS',
          });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation blocked or unavailable in preview environment:', err);
        // Explicitly identify browser/iframe restriction
        // NEVER fabricate or silently switch to Port Harcourt
        setIframeBlocked(true);
        setLocationError('Live location is unavailable in this preview.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
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
      source: 'MANUAL',
    });
    setSearchQuery('');
    setLocationError(null);
    setIframeBlocked(false);
  };

  const updateManualField = (fields: Partial<LocationCoordinates>) => {
    const isPreservingGps = location?.source === 'GPS';
    const updated: LocationCoordinates = {
      lat: location?.lat ?? 0,
      lng: location?.lng ?? 0,
      address: location?.address || '',
      area: location?.area || '',
      city: location?.city || '',
      state: location?.state || '',
      landmark: location?.landmark,
      country: 'Nigeria',
      accuracyMeters: location?.accuracyMeters,
      timestamp: location?.timestamp,
      capturedAt: location?.capturedAt,
      source: isPreservingGps ? 'GPS' : 'MANUAL',
      ...fields,
    };

    // If coordinates were 0 and not GPS, attempt local lookup match
    if (!isPreservingGps && updated.lat === 0 && updated.lng === 0) {
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
      (location.lat !== 0 || location.lng !== 0 || location.address || location.city)
  );

  return (
    <div id="repair-location-selector" className="space-y-4">
      {/* ACTIVE LOCATION DISPLAY CARD */}
      {hasLocation && location ? (
        <div
          id="active-location-card"
          className={`p-4 rounded-2xl border space-y-2 ${
            location.source === 'DEVELOPMENT_FALLBACK'
              ? 'bg-amber-50/80 border-amber-300'
              : location.source === 'GPS' && (!location.city || !location.state)
              ? 'bg-amber-50 border-amber-200'
              : location.source === 'GPS'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  location.source === 'DEVELOPMENT_FALLBACK'
                    ? 'bg-amber-600 text-white'
                    : location.source === 'GPS'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                <MapPin className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                {/* State Labels */}
                <span className="text-[11px] font-bold uppercase tracking-wider block">
                  {location.source === 'GPS' && location.city && location.state ? (
                    // State A: GPS detected with resolved location
                    <span id="state-gps-detected" className="text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      Live GPS Location Detected
                    </span>
                  ) : location.source === 'GPS' ? (
                    // State B: GPS detected but address unresolved
                    <span id="state-gps-unresolved" className="text-amber-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      GPS Location Detected
                    </span>
                  ) : location.source === 'DEVELOPMENT_FALLBACK' ? (
                    // State E: Development fallback
                    <span id="state-dev-fallback" className="text-amber-900 font-extrabold flex items-center gap-1">
                      ⚠️ Development Test Location
                    </span>
                  ) : (
                    // State D: Manual location
                    <span id="state-manual-location" className="text-slate-700">
                      Location Selected Manually
                    </span>
                  )}
                </span>

                {/* Location Details */}
                {location.source === 'DEVELOPMENT_FALLBACK' ? (
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Port Harcourt, Rivers State
                    </p>
                    <p className="text-xs text-slate-600">
                      Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)} (Development Fallback Only)
                    </p>
                  </div>
                ) : location.source === 'GPS' && (!location.city || !location.state) ? (
                  // State B Details
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">
                      Coordinates: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </p>
                    {location.accuracyMeters && (
                      <p className="text-[10px] font-bold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded-md inline-block">
                        Accuracy: ±{Math.round(location.accuracyMeters)} m
                      </p>
                    )}
                    <div className="p-2.5 bg-amber-100/60 border border-amber-300/80 rounded-xl text-[11px] text-amber-900 space-y-1 mt-1 font-medium">
                      <p className="font-extrabold flex items-center gap-1 text-amber-950">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Address could not be determined. Please confirm your repair area.</span>
                      </p>
                      <p className="text-[10px] text-amber-800">
                        Your device coordinates have been securely saved. Please fill in your street, city, and state below so technicians can quote accurately.
                      </p>
                    </div>
                  </div>
                ) : (
                  // State A or D Details
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-snug">
                      {location.address || location.area || `${location.city}, ${location.state}`}
                    </p>
                    <p className="text-xs text-slate-600">
                      {[location.city, location.state].filter(Boolean).join(', ')}{' '}
                      {location.landmark ? `(near ${location.landmark})` : ''}
                    </p>
                    {location.source === 'GPS' && location.accuracyMeters && (
                      <p className="text-[10px] font-bold text-emerald-800 bg-emerald-100/50 px-2 py-0.5 rounded-md inline-block mt-1">
                        Accuracy: ±{Math.round(location.accuracyMeters)} m
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              id="change-location-btn"
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
                setIframeBlocked(false);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 cursor-pointer shrink-0"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
          <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No Location Selected Yet</p>
          <p className="text-[11px] text-slate-500">
            Choose your area in Rivers State or use your current location to discover certified technicians nearby.
          </p>
        </div>
      )}

      {/* INTERACTIVE GOOGLE MAP WITH DRAGGABLE ADVANCED MARKER PIN */}
      <InteractiveLocationMap
        location={
          location && (location.lat !== 0 || location.lng !== 0)
            ? location
            : {
                lat: 4.8156,
                lng: 7.0498,
                address: 'Port Harcourt, Rivers State',
                area: 'Garrison',
                city: 'Port Harcourt',
                state: 'Rivers State',
                country: 'Nigeria',
                source: 'MANUAL',
              }
        }
        onChangeLocation={onChange}
      />

      {/* OPTION A: USE CURRENT LOCATION BUTTON */}
      <div className="space-y-2">
        <button
          type="button"
          id="btn-use-current-location"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <Navigation className={`w-4 h-4 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Detecting your coordinates...' : 'Use my current location'}</span>
        </button>

        {/* STATE C: GPS BLOCKED BY BROWSER / IFRAME */}
        {iframeBlocked && (
          <div
            id="state-gps-blocked"
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 animate-fadeIn"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-extrabold text-amber-950">
                  Live location is unavailable in this preview.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Embedded preview iframes restrict access to device GPS. To use live device location, open Fixhub directly in a dedicated tab or select your location manually below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                id="btn-open-new-tab"
                onClick={handleOpenInNewTab}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Open in New Tab</span>
              </button>

              <button
                type="button"
                id="btn-select-manually"
                onClick={() => {
                  setIsManualInput(true);
                  const searchInput = document.getElementById('location-search-input');
                  if (searchInput) searchInput.focus();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Select Location Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* Development Fallback Panel (DEV ENVIRONMENT ONLY) */}
        {isDev && (
          <div
            id="state-dev-panel"
            className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900">
                Development Test Location (Rivers State)
              </span>
              <span className="text-[9px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                DEV ONLY
              </span>
            </div>
            <p className="text-[11px] text-blue-900 leading-snug">
              Simulate testing in Port Harcourt, Rivers State. Rejected in production environments.
            </p>
            <button
              type="button"
              id="dev-fallback-action"
              onClick={() => {
                onChange({
                  lat: 4.8156,
                  lng: 7.0498,
                  address: 'Aba Road, Garrison, Port Harcourt',
                  landmark: 'Garrison Junction',
                  area: 'Garrison',
                  city: 'Port Harcourt',
                  state: 'Rivers State',
                  country: 'Nigeria',
                  source: 'DEVELOPMENT_FALLBACK',
                  accuracyMeters: 25,
                  timestamp: new Date().toISOString(),
                  capturedAt: new Date().toISOString(),
                });
                setLocationError(null);
                setIframeBlocked(false);
              }}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              Set Development Test Location (Port Harcourt)
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

      {/* OPTION B: SEARCH RIVERS STATE HUBS & AREAS */}
      <div className="space-y-3">
        {/* Google Places Search (New Places API) */}
        {hasKey && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Places Live Search</span>
              </span>
              <span className="text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                NIGERIA-WIDE
              </span>
            </div>
            <GooglePlaceAutocomplete onPlaceSelected={onChange} />
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            id="location-search-input"
            type="text"
            placeholder="Search Port Harcourt area (e.g. Garrison, Mile 1, Aba Road, Rumuola)..."
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

        {/* Rivers State Seeded Repair Hubs */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Rivers State Pre-Seeded Repair Hubs
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
