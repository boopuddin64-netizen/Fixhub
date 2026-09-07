import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { LocationCoordinates } from '../../types';

interface GooglePlaceAutocompleteProps {
  onPlaceSelected: (location: LocationCoordinates) => void;
  placeholder?: string;
  initialValue?: string;
}

export const GooglePlaceAutocomplete: React.FC<GooglePlaceAutocompleteProps> = ({
  onPlaceSelected,
  placeholder = 'Search address, street, or area in Nigeria...',
  initialValue = '',
}) => {
  const placesLib = useMapsLibrary('places');
  const [inputString, setInputString] = useState<string>(initialValue);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch suggestions using modern Places API (New) AutocompleteSuggestion
  useEffect(() => {
    if (!placesLib) return;
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;

    if (!inputString.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const request: google.maps.places.AutocompleteRequest = {
      input: inputString,
      sessionToken: sessionTokenRef.current,
      region: 'ng', // Restrict to Nigeria
    };

    setIsLoading(true);
    AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
      .then((res: { suggestions: google.maps.places.AutocompleteSuggestion[] }) => {
        setSuggestions(res.suggestions || []);
        setIsLoading(false);
        setIsOpen(Boolean(res.suggestions && res.suggestions.length > 0));
      })
      .catch((err: any) => {
        console.warn('Google Places autocomplete fetch error:', err);
        setSuggestions([]);
        setIsLoading(false);
      });
  }, [placesLib, inputString]);

  const handleSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;

      try {
        setIsLoading(true);
        // 1. Convert prediction to modern Place instance
        const place = suggestion.placePrediction.toPlace();

        // 2. Fetch required fields via Promise-based API (Places API New)
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        });

        // 3. Reset session token per best practice
        sessionTokenRef.current = null;
        setIsOpen(false);

        const lat = place.location?.lat() || 0;
        const lng = place.location?.lng() || 0;
        const formattedAddress = place.formattedAddress || suggestion.placePrediction.text.text;

        // Parse address components
        let street = '';
        let neighborhood = '';
        let city = '';
        let state = '';
        let country = 'Nigeria';

        if (place.addressComponents) {
          for (const comp of place.addressComponents) {
            const types = comp.types || [];
            if (types.includes('route') || types.includes('street_address')) {
              street = comp.longText || comp.shortText || '';
            } else if (types.includes('sublocality') || types.includes('neighborhood')) {
              neighborhood = comp.longText || comp.shortText || '';
            } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
              city = comp.longText || comp.shortText || '';
            } else if (types.includes('administrative_area_level_1')) {
              state = comp.longText || comp.shortText || '';
            } else if (types.includes('country')) {
              country = comp.longText || comp.shortText || 'Nigeria';
            }
          }
        }

        setInputString(place.displayName || formattedAddress);

        onPlaceSelected({
          lat,
          lng,
          address: formattedAddress,
          landmark: neighborhood || undefined,
          area: neighborhood || city || undefined,
          city: city || undefined,
          state: state || undefined,
          country,
          source: 'GEOCODED',
          capturedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          accuracyMeters: 5,
        });
      } catch (err) {
        console.error('Failed to fetch place details:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [placesLib, onPlaceSelected]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3.5" />
        <input
          id="google-place-search-input"
          type="text"
          value={inputString}
          onChange={(e) => setInputString(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-emerald-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 shadow-2xs font-medium"
        />
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-emerald-600 absolute right-3 top-3 animate-spin" />
        ) : inputString ? (
          <button
            type="button"
            onClick={() => {
              setInputString('');
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none p-0"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1 divide-y divide-slate-100">
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(s)}
              className="p-3 hover:bg-emerald-50/80 cursor-pointer flex items-start gap-2.5 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 leading-snug">
                  {s.placePrediction?.mainText?.text || s.placePrediction?.text.text}
                </p>
                {s.placePrediction?.secondaryText?.text && (
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.placePrediction.secondaryText.text}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
