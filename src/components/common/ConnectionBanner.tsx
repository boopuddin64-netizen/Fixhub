import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ConnectionBannerProps {
  isOnline: boolean;
  loadFailing: boolean;
  retrying: boolean;
  onRetry: () => void;
}

/** Slim status banner: offline (device has no network) or the server could not be reached, with a Retry button. */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ isOnline, loadFailing, retrying, onRetry }) => {
  if (isOnline && !loadFailing) return null;
  const message = !isOnline
    ? "You're offline. Showing your last saved information; it will refresh when you reconnect."
    : "We couldn't refresh your repairs. Showing your last saved information.";
  return (
    <div role="status" aria-live="polite" id="connection-banner" className="bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-xs">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  );
};
