import React, { useState, useEffect, useCallback } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import { LocationCoordinates } from '../../types';
import { useGoogleMaps } from './GoogleMapsProvider';
import { reverseGeocode } from '../../utils/reverseGeocoding';

interface InteractiveLocationMapProps {
  location: LocationCoordinates;
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

  // Default coordinate center (Port Harcourt Garrison: 4.8156, 7.0128 if 0,0)
  const currentLat = location.lat && location.lat !== 0 ? location.lat : 4.8156;
  const currentLng = location.lng && location.lng !== 0 ? location.lng : 7.0128;

  const handleCoordinateUpdate = useCallback(
    async (lat: number, lng: number) => {
      setIsReverseGeocoding(true);
      const geocodeResult = await reverseGeocode(lat, lng);
      setIsReverseGeocoding(false);

      if (geocodeResult.resolved && geocodeResult.location) {
        const loc = geocodeResult.location;
        onChangeLocation({
          ...location,
          lat,
          lng,
          address: loc.address || `${loc.street || ''} ${loc.city || ''}`.trim() || location.address,
          street: loc.street || location.street,
          landmark: loc.landmark || location.landmark,
          area: loc.area || location.area,
          city: loc.city || location.city,
          state: loc.state || location.state,
          country: loc.country || location.country || 'Nigeria',
          source: 'GEOCODED',
          accuracyMeters: 5,
          timestamp: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        });
      } else {
        onChangeLocation({
          ...location,
          lat,
          lng,
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
            defaultCenter={{ lat: currentLat, lng: currentLng }}
            defaultZoom={15}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
            onClick={(e) => {
              if (e.detail?.latLng) {
                handleCoordinateUpdate(e.detail.latLng.lat, e.detail.latLng.lng);
              }
            }}
          >
            <MapController center={{ lat: currentLat, lng: currentLng }} />

            {/* Customer Location Draggable Pin */}
            <AdvancedMarker
              position={{ lat: currentLat, lng: currentLng }}
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
          </Map>

          {/* Draggable Guide Badge / Loading State */}
          <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold shadow-md flex items-center gap-1.5 pointer-events-none">
            {isReverseGeocoding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                <span>Updating address...</span>
              </>
            ) : (
              <>
                <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Drag pin or tap map to set exact spot</span>
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {location.address || location.area || 'Location Pinned'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              Interactive satellite map preview requires Maps API key. You can use GPS or search any area below.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
