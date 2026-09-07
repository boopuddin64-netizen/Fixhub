import React, { useState, useEffect, useCallback } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Crosshair, Sparkles, Key, Check } from 'lucide-react';
import { LocationCoordinates } from '../../types';
import { useGoogleMaps } from './GoogleMapsProvider';
import { reverseGeocode } from '../../utils/reverseGeocoding';

interface InteractiveLocationMapProps {
  location: LocationCoordinates;
  onChangeLocation: (newLoc: LocationCoordinates) => void;
  nearbyTechnicians?: Array<{
    id: string;
    businessName: string;
    lat: number;
    lng: number;
  }>;
}

// Controller component to smoothly pan map when coordinates change externally
const MapController: React.FC<{ center: { lat: number; lng: number } }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center.lat && center.lng) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng]);
  return null;
};

export const InteractiveLocationMap: React.FC<InteractiveLocationMapProps> = ({
  location,
  onChangeLocation,
  nearbyTechnicians = [],
}) => {
  const { hasKey, apiKey, setApiKey } = useGoogleMaps();
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [tempKey, setTempKey] = useState<string>('');

  // Default coordinate center (Port Harcourt Garrison Hub if 0)
  const currentLat = location.lat && location.lat !== 0 ? location.lat : 4.8156;
  const currentLng = location.lng && location.lng !== 0 ? location.lng : 7.0498;

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
          address: loc.address || `${loc.street || ''} ${loc.city || ''}`.trim(),
          landmark: loc.landmark || location.landmark,
          area: loc.area || location.area,
          city: loc.city || location.city || 'Port Harcourt',
          state: loc.state || location.state || 'Rivers State',
          country: loc.country || 'Nigeria',
          source: 'GPS',
          accuracyMeters: 5,
          timestamp: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        });
      } else {
        onChangeLocation({
          ...location,
          lat,
          lng,
          source: 'GPS',
          timestamp: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        });
      }
    },
    [location, onChangeLocation]
  );

  return (
    <div className="space-y-2">
      {/* Map Header & Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800">
            Pinpoint Location on Map
          </span>
          {isReverseGeocoding && (
            <span className="text-[10px] text-emerald-600 animate-pulse font-medium">
              Updating address...
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
        >
          <Key className="w-3 h-3" />
          <span>{hasKey ? 'Google Maps Connected' : 'Connect Maps Key'}</span>
        </button>
      </div>

      {/* Optional Google Maps API Key Input for Prototyping / Demo */}
      {showKeyInput && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">Google Maps Platform API Key</span>
            <a
              href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-600 font-bold hover:underline"
            >
              Get Free Demo Key →
            </a>
          </div>
          <p className="text-[11px] text-slate-500">
            Enter your Google Maps API Key or free Maps Demo Key to enable high-precision satellite imagery and live search.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => {
                if (tempKey.trim()) {
                  setApiKey(tempKey.trim());
                  setShowKeyInput(false);
                }
              }}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-slate-800"
            >
              Save Key
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={() => {
                  setApiKey('');
                  setTempKey('');
                }}
                className="px-2 py-1.5 text-rose-600 font-bold hover:bg-rose-50 rounded-lg text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Map Box */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100">
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

              {/* Customer Draggable Pin */}
              <AdvancedMarker
                position={{ lat: currentLat, lng: currentLng }}
                draggable={true}
                onDragEnd={(e) => {
                  if (e.latLng) {
                    handleCoordinateUpdate(e.latLng.lat, e.latLng.lng);
                  }
                }}
                title="Your repair location"
              >
                <Pin
                  background="#059669"
                  borderColor="#047857"
                  glyphColor="#ffffff"
                  scale={1.2}
                />
              </AdvancedMarker>

              {/* Nearby Certified Technicians on Map */}
              {nearbyTechnicians.map((tech) => (
                <AdvancedMarker
                  key={tech.id}
                  position={{ lat: tech.lat, lng: tech.lng }}
                  title={tech.businessName}
                >
                  <Pin
                    background="#2563eb"
                    borderColor="#1d4ed8"
                    glyphColor="#ffffff"
                    scale={0.9}
                  />
                </AdvancedMarker>
              ))}
            </Map>

            {/* Floating Guide Badge */}
            <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-md flex items-center gap-1.5 pointer-events-none">
              <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Drag green pin to doorstep or tap map</span>
            </div>
          </>
        ) : (
          /* Fallback Visual Coordinate Radar when no API Key is provided */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-radial from-slate-50 to-slate-100 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-xs font-bold text-slate-900">
                Google Maps Interactive Satellite Pinning
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Connect a Google Maps Platform API key or free Maps Demo Key to view satellite street maps and drag pins directly onto buildings.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowKeyInput(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Connect Google Maps Key</span>
              </button>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Free Demo Key →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Coordinate & Accuracy Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono">
        <span>
          Lat: {currentLat.toFixed(5)}, Lng: {currentLng.toFixed(5)}
        </span>
        <span className="text-emerald-700 font-sans font-bold">
          Rivers State Hub
        </span>
      </div>
    </div>
  );
};
