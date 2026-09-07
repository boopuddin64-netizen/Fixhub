import React, { useState, useEffect, useCallback } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import { LocationCoordinates } from '../../types';
import { useGoogleMaps } from './GoogleMapsProvider';
import { reverseGeocode } from '../../utils/reverseGeocoding';

interface InteractiveLocationMapProps {
  location?: LocationCoordinates | null;
  onChangeLocation: (newLoc: LocationCoordinates) => void;
  className?: string;
}

// Controller component to smoothly pan map when coordinates change externally
const MapController: React.FC<{ center: { lat: number; lng: number } }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center.lat && center.lng && center.lat !== 0 && center.lng !== 0) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng]);
  return null;
};

export const InteractiveLocationMap: React.FC<InteractiveLocationMapProps> = ({
  location,
  onChangeLocation,
  className = '',
}) => {
  const { hasKey } = useGoogleMaps();
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  const hasValidLocation = Boolean(
    location &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      (location.lat !== 0 || location.lng !== 0)
  );

  // Map visual center default: Port Harcourt (visual center only; never submitted or stored as user location)
  const centerLat = hasValidLocation && location?.lat ? location.lat : 4.8156;
  const centerLng = hasValidLocation && location?.lng ? location.lng : 7.0128;

  const handleCoordinateUpdate = useCallback(
    async (lat: number, lng: number) => {
      setIsReverseGeocoding(true);
      const geocodeResult = await reverseGeocode(lat, lng);
      setIsReverseGeocoding(false);

      if (geocodeResult.resolved && geocodeResult.location) {
        const loc = geocodeResult.location;
        onChangeLocation({
          ...(location || {}),
          lat,
          lng,
          address: loc.address || `${loc.street || ''} ${loc.city || ''}`.trim() || location?.address || 'Selected Map Location',
          street: loc.street || location?.street,
          landmark: loc.landmark || location?.landmark,
          area: loc.area || location?.area,
          city: loc.city || location?.city || 'Port Harcourt',
          state: loc.state || location?.state || 'Rivers State',
          country: loc.country || location?.country || 'Nigeria',
          source: 'GEOCODED',
          accuracyMeters: 5,
          timestamp: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        });
      } else {
        onChangeLocation({
          ...(location || {}),
          lat,
          lng,
          address: location?.address || 'Selected Map Location',
          area: location?.area,
          city: location?.city,
          state: location?.state,
          country: location?.country || 'Nigeria',
          source: 'GEOCODED',
          timestamp: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        });
      }
    },
    [location, onChangeLocation]
  );

  return (
    <div className={`relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100 ${className}`}>
      {hasKey ? (
        <>
          <Map
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: centerLat, lng: centerLng }}
            defaultZoom={hasValidLocation ? 15 : 12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
            onClick={(e) => {
              if (e.detail?.latLng) {
                handleCoordinateUpdate(e.detail.latLng.lat, e.detail.latLng.lng);
              }
            }}
          >
            <MapController center={{ lat: centerLat, lng: centerLng }} />

            {/* Customer Location Draggable Pin - ONLY rendered when genuine location exists */}
            {hasValidLocation && location?.lat && location?.lng && (
              <AdvancedMarker
                position={{ lat: location.lat, lng: location.lng }}
                draggable={true}
                onDragEnd={(e) => {
                  if (e.latLng) {
                    handleCoordinateUpdate(e.latLng.lat, e.latLng.lng);
                  }
                }}
                title="Drag pin to your exact building or doorstep"
              >
                <Pin
                  background="#059669"
                  borderColor="#047857"
                  glyphColor="#ffffff"
                  scale={1.2}
                />
              </AdvancedMarker>
            )}
          </Map>

          {/* Draggable Guide Badge / Loading State */}
          <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold shadow-md flex items-center gap-1.5 pointer-events-none">
            {isReverseGeocoding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                <span>Updating address...</span>
              </>
            ) : hasValidLocation ? (
              <>
                <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Drag pin or tap map to adjust location</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Tap map or search above to choose location</span>
              </>
            )}
          </div>
        </>
      ) : (
        /* Graceful map preview when Google Maps API key is not configured */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 relative overflow-hidden">
          {/* Subtle grid pattern background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative z-10 flex flex-col items-center space-y-2">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs ${
                hasValidLocation
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <MapPin className="w-5 h-5" />
            </div>
            {hasValidLocation && location ? (
              <>
                <p className="text-xs font-bold text-slate-800">
                  {location.address || location.area || 'Location Selected'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {[location.city, location.state].filter(Boolean).join(', ') || 'Nigeria'}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-700">No location selected yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  Search for your area, street or landmark, or use your current location.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
