import React, { createContext, useContext } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

interface GoogleMapsContextType {
  apiKey: string;
  hasKey: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  apiKey: '',
  hasKey: false,
});

export const useGoogleMaps = () => useContext(GoogleMapsContext);

export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read key strictly from environment variable (VITE_GOOGLE_MAPS_API_KEY)
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const hasKey = Boolean(apiKey && apiKey.trim().length > 5);

  const contextValue: GoogleMapsContextType = {
    apiKey,
    hasKey,
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
