import React, { useState, useRef } from 'react';
import { LocationCoordinates } from '../../../types';
import { searchNigerianLocations, NigerianArea, POPULAR_NIGERIAN_LOCATIONS } from '../../../data/nigerianLocations';
import { reverseGeocode } from '../../../utils/reverseGeocoding';
import { MapPin, Navigation, Search, Check, AlertCircle, ExternalLink, Loader2, X, ChevronDown } from 'lucide-react';
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
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [iframeBlocked, setIframeBlocked] = useState<boolean>(false);
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [unresolvedGpsPrompt, setUnresolvedGpsPrompt] = useState<boolean>(false);
  const [customStreetInput, setCustomStreetInput] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { hasKey } = useGoogleMaps();

  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const isDev = !isProduction && Boolean((import.meta as any).env?.DEV);

  const filteredAreas = searchQuery.trim() ? searchNigerianLocations(searchQuery) : [];
  const popularHubs = POPULAR_NIGERIAN_LOCATIONS.slice(0, 8);

  const hasLocation = Boolean(
    location &&
      (location.lat !== 0 || location.lng !== 0 || location.address || location.city)
  );

  // 1. Uber/Bolt: Use current location (GPS)
  const handleUseCurrentLocation = () => {
    setLocationError(null);
    setIframeBlocked(false);
    setUnresolvedGpsPrompt(false);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setIframeBlocked(true);
      setLocationError('Live location is unavailable in this preview.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);

        // Authoritative real GPS coordinates from device
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const timestampIso = new Date(pos.timestamp).toISOString();

        // Reverse geocoding attempt (Layer 1 Google Proxy -> Layer 2 Nominatim)
        const geocodeResult = await reverseGeocode(rawLat, rawLng);

        if (geocodeResult.resolved && geocodeResult.location) {
          const loc = geocodeResult.location;
          setUnresolvedGpsPrompt(false);
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
          // State 2: GPS Succeeded, but Reverse Geocoding Unresolved
          // REAL GPS coordinates remain source of truth! NEVER fabricate city/state or substitute hub!
          setUnresolvedGpsPrompt(true);
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
        console.warn('Geolocation unavailable or restricted:', err);
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
      address: area.landmark ? `${area.name} (near ${area.landmark})` : `${area.name}, ${area.city}`,
      landmark: area.landmark,
      area: area.name,
      city: area.city,
      state: area.state,
      country: 'Nigeria',
      source: 'MANUAL',
    });
    setSearchQuery('');
    setSearchFocused(false);
    setLocationError(null);
    setIframeBlocked(false);
    setUnresolvedGpsPrompt(false);
  };

  const handleSaveUnresolvedStreet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    onChange({
      ...location,
      address: customStreetInput.trim() || location.address,
      area: customStreetInput.trim() || location.area,
      source: 'GPS', // GPS coordinates remain authoritative!
    });
    setUnresolvedGpsPrompt(false);
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

    if (!isPreservingGps && updated.lat === 0 && updated.lng === 0) {
      const matched = searchNigerianLocations(updated.city || updated.area || updated.state)[0];
      if (matched) {
        updated.lat = matched.lat;
        updated.lng = matched.lng;
        if (!updated.state) updated.state = matched.state;
      }
    }

    onChange(updated);
  };

  return (
    <div id="repair-location-selector" className="space-y-4">
      {/* 1. UBER/BOLT SEARCH & GPS BAR */}
      <div className="space-y-2.5">
        {/* Unified Search Input */}
        <div className="relative">
          {hasKey ? (
            <GooglePlaceAutocomplete
              onPlaceSelected={(newLoc) => {
                onChange(newLoc);
                setLocationError(null);
                setIframeBlocked(false);
                setUnresolvedGpsPrompt(false);
              }}
              placeholder="Where are you located? (Search address, area, or landmark)..."
              initialValue={location?.address || ''}
            />
          ) : (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                ref={searchInputRef}
                id="location-search-input"
                type="text"
                placeholder="Where are you located? (e.g. Garrison, Aba Road, Rumuola)..."
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200/90 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchFocused(false);
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer bg-transparent border-none"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Autocomplete Suggestions Dropdown (for catalog search when Google Places is not configured) */}
          {!hasKey && searchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
              {filteredAreas.length > 0 ? (
                filteredAreas.map((area, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectArea(area)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{area.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {area.city}, {area.state} {area.landmark ? `• near ${area.landmark}` : ''}
                        </p>
                      </div>
                    </div>
                    {area.isTechHub && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                        Repair Hub
                      </span>
                    )}
                  </button>
                ))
              ) : searchQuery.trim() ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-600 font-medium">
                    No predefined area found for "{searchQuery}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        lat: location?.lat || 4.8156,
                        lng: location?.lng || 7.0128,
                        address: searchQuery.trim(),
                        area: searchQuery.trim(),
                        city: 'Port Harcourt',
                        state: 'Rivers State',
                        country: 'Nigeria',
                        source: 'MANUAL',
                      });
                      setSearchFocused(false);
                    }}
                    className="mt-2 text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    Set "{searchQuery}" as my location
                  </button>
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Popular Areas in Rivers State
                  </p>
                  <div className="space-y-1">
                    {popularHubs.map((hub, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectArea(hub)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800">{hub.name}</span>
                        <span className="text-[10px] text-slate-400">{hub.city}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Use Current Location Button */}
        <button
          type="button"
          id="btn-use-current-location"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              <span>Finding your location...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 text-emerald-200" />
              <span>Use current location</span>
            </>
          )}
        </button>
      </div>

      {/* STATE 3: GPS BLOCKED BY BROWSER / IFRAME */}
      {iframeBlocked && (
        <div
          id="state-gps-blocked"
          className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-3 animate-fadeIn"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-extrabold text-amber-950">
                Live location is unavailable in this preview.
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Embedded browser iframes restrict device GPS access. You can search your area below or open Fixhub in a new browser tab.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              id="btn-select-manually"
              onClick={() => {
                if (searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Area</span>
            </button>

            <button
              type="button"
              id="btn-open-new-tab"
              onClick={handleOpenInNewTab}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open in New Tab</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 2: GPS FOUND BUT UNRESOLVED STREET ADDRESS */}
      {unresolvedGpsPrompt && location?.source === 'GPS' && (
        <form
          onSubmit={handleSaveUnresolvedStreet}
          className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2.5 animate-fadeIn"
        >
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-blue-950">
                We found your coordinates, but could not resolve your street address.
              </p>
              <p className="text-[11px] text-blue-800">
                Please enter your street name or nearest landmark so technicians can find you.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customStreetInput}
              onChange={(e) => setCustomStreetInput(e.target.value)}
              placeholder="e.g. 15 Aba Road, near Garrison Junction"
              className="flex-1 px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer shrink-0"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* 2. INTERACTIVE MAP (Uber/Bolt style) */}
      <InteractiveLocationMap
        location={
          location && (location.lat !== 0 || location.lng !== 0)
            ? location
            : {
                lat: 4.8156,
                lng: 7.0128,
                address: 'Port Harcourt, Rivers State',
                area: 'Garrison',
                city: 'Port Harcourt',
                state: 'Rivers State',
                country: 'Nigeria',
                source: 'MANUAL',
              }
        }
        onChangeLocation={(newLoc) => {
          onChange(newLoc);
          setUnresolvedGpsPrompt(false);
          setLocationError(null);
        }}
      />

      {/* 3. ACTIVE SELECTED LOCATION CARD */}
      {hasLocation && location ? (
        <div
          id="active-location-card"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  location.source === 'GPS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-900 leading-snug">
                    {location.address || location.area || `${location.city}, ${location.state}`}
                  </p>
                  {location.source === 'GPS' && (
                    <span
                      id="state-gps-detected"
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-bold shrink-0"
                    >
                      GPS Confirmed
                    </span>
                  )}
                  {location.source === 'DEVELOPMENT_FALLBACK' && (
                    <span
                      id="state-dev-fallback"
                      className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold shrink-0"
                    >
                      Test Location
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {[location.city, location.state].filter(Boolean).join(', ') || 'Nigeria'}
                  {location.landmark ? ` • near ${location.landmark}` : ''}
                </p>
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
                setUnresolvedGpsPrompt(false);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer shrink-0 transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      ) : null}

      {/* 4. SUGGESTED AREAS (Rivers State Initial Ecosystem) */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Suggested Areas in Port Harcourt
        </p>
        <div className="flex flex-wrap gap-1.5">
          {popularHubs.map((hub, idx) => {
            const isSelected =
              location != null &&
              ((location.lat === hub.lat && location.lng === hub.lng) ||
                location.area === hub.name);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectArea(hub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                {hub.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. MANUAL ADDRESS ENTRY TOGGLE */}
      <div className="pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsManualInput(!isManualInput)}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-transparent border-none py-1"
        >
          <span>{isManualInput ? 'Hide manual address form' : 'Enter address manually'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isManualInput ? 'rotate-180' : ''}`} />
        </button>

        {isManualInput && (
          <div className="mt-2.5 p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3 shadow-2xs animate-fadeIn">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Street Address / Building
              </label>
              <input
                type="text"
                value={location?.address || ''}
                onChange={(e) => updateManualField({ address: e.target.value })}
                placeholder="e.g. 14 Aba Road"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  City / Town
                </label>
                <input
                  type="text"
                  value={location?.city || ''}
                  onChange={(e) => updateManualField({ city: e.target.value })}
                  placeholder="e.g. Port Harcourt"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={location?.state || ''}
                  onChange={(e) => updateManualField({ state: e.target.value })}
                  placeholder="e.g. Rivers State"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nearest Landmark (optional)
              </label>
              <input
                type="text"
                value={location?.landmark || ''}
                onChange={(e) => updateManualField({ landmark: e.target.value })}
                placeholder="e.g. Near Garrison Junction"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. DEV ENVIRONMENT ONLY: TEST LOCATION TRIGGER */}
      {isDev && (
        <div id="state-dev-panel" className="pt-2">
          <button
            type="button"
            id="dev-fallback-action"
            onClick={() => {
              onChange({
                lat: 4.8156,
                lng: 7.0128,
                address: 'Plot 14 Aba Road, Garrison',
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
              setUnresolvedGpsPrompt(false);
            }}
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-xl border border-dashed border-slate-300 transition-colors cursor-pointer"
          >
            [Dev Only] Quick Fill: Garrison, Port Harcourt
          </button>
        </div>
      )}
    </div>
  );
};
