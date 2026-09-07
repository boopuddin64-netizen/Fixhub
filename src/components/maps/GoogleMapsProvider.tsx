import React, { createContext, useContext, useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

interface GoogleMapsContextType {
  apiKey: string;
  hasKey: boolean;
  setApiKey: (key: string) => void;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  apiKey: '',
  hasKey: false,
  setApiKey: () => {},
});

export const useGoogleMaps = () => useContext(GoogleMapsContext);

export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read key from environment variable (Vite import.meta.env, stored in localStorage, or active demo key)
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const DEMO_PROTOTYPE_KEY = 'AIzaSyBPvtDkrVi3GcTgDwWP6xLRDUofu-gBlmU';

  const [apiKey, setApiKeyState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('fixhub_google_maps_key');
      if (stored) return stored;
    }
    if (envKey) return envKey;
    return DEMO_PROTOTYPE_KEY;
  });

  const setApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKeyState(trimmed);
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('fixhub_google_maps_key', trimmed);
      } else {
        localStorage.removeItem('fixhub_google_maps_key');
      }
    }
  };

  const hasKey = Boolean(apiKey && apiKey.length > 5);

  const contextValue: GoogleMapsContextType = {
    apiKey,
    hasKey,
    setApiKey,
  };

  if (!hasKey) {
    return (
      <GoogleMapsContext.Provider value={contextValue}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      <APIProvider
        apiKey={apiKey}
        region="NG"
        language="en"
        solutionChannel="gmp_mcp_codeassist_v1_aistudio"
      >
        {children}
      </APIProvider>
    </GoogleMapsContext.Provider>
  );
};
