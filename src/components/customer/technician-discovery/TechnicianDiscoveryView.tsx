import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, Smartphone, MapPin, Wrench } from 'lucide-react';
import { ApiClient } from '../../../api/client';
import { RepairRequest, TechnicianMatchResult } from '../../../types';
import { TechnicianDiscoveryCard } from './TechnicianDiscoveryCard';
import { TechnicianFilterBar } from './TechnicianFilterBar';
import { TechnicianDetailsView } from './TechnicianDetailsView';
import { TechnicianEmptyState } from './TechnicianEmptyState';

interface TechnicianDiscoveryViewProps {
  requestId: string;
  onBack: () => void;
}

export const TechnicianDiscoveryView: React.FC<TechnicianDiscoveryViewProps> = ({
  requestId,
  onBack,
}) => {
  const [request, setRequest] = useState<RepairRequest | null>(null);
  const [matches, setMatches] = useState<TechnicianMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'recommended' | 'nearest' | 'rating'>('recommended');

  // Selected technician for detailed view
  const [selectedMatch, setSelectedMatch] = useState<TechnicianMatchResult | null>(null);

  const hasFetchedRef = useRef(false);

  const fetchDiscovery = async (dist = maxDistance) => {
    setIsLoading(true);
    setError(null);
    try {
      // First fetch request details if not loaded
      const reqs = await ApiClient.getRepairRequests();
      const currentReq = reqs.find((r: RepairRequest) => r.id === requestId);
      if (currentReq) {
        setRequest(currentReq);
      }

      // Explicit match call
      const token = localStorage.getItem('fixhub_token');
      const res = await fetch(`/api/repairs/requests/${requestId}/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ maxDistanceKm: dist }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to match technicians.');
      }

      if (data.request) setRequest(data.request);
      if (Array.isArray(data.matchedTechnicians)) {
        setMatches(data.matchedTechnicians);
      }
    } catch (err: any) {
      console.error('Error in technician discovery:', err);
      setError(err.message || 'Could not load nearby technicians. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDiscovery(maxDistance);
    }
  }, [requestId]);

  const handleDistanceChange = (newDist: number) => {
    setMaxDistance(newDist);
    fetchDiscovery(newDist);
  };

  // Filter and Sort matches locally
  const filteredMatches = matches.filter((m) => {
    if (m.distanceKm > maxDistance) return false;
    if (verifiedOnly && !(m.technician.isVerified ?? true)) return false;
    return true;
  });

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (sortBy === 'nearest') {
      return a.distanceKm - b.distanceKm;
    }
    if (sortBy === 'rating') {
      return (b.technician.rating || 4.8) - (a.technician.rating || 4.8);
    }
    // Recommended (default backend score)
    return b.totalScore - a.totalScore;
  });

  if (selectedMatch) {
    return (
      <TechnicianDetailsView
        match={selectedMatch}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  const formattedReqId = requestId.startsWith('req_') ? requestId.replace(/^req_/, 'REQ-').toUpperCase() : requestId.toUpperCase();

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Nearby Repair Technicians
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Request ID: <span className="font-bold text-slate-700">{formattedReqId}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchDiscovery(maxDistance)}
          className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Repair Context Banner */}
      {request && (
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-md flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Repair Context</span>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                {request.deviceBrand} {request.deviceModel}
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{request.customerLocation?.area || request.customerLocation?.city || 'Selected Location'}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {(request.issues || []).map((issue, idx) => (
              <span key={idx} className="px-2.5 py-1 bg-white/10 text-white text-[11px] font-semibold rounded-lg border border-white/10">
                {issue}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Sorting */}
      {!isLoading && !error && matches.length > 0 && (
        <TechnicianFilterBar
          maxDistance={maxDistance}
          onChangeMaxDistance={handleDistanceChange}
          verifiedOnly={verifiedOnly}
          onChangeVerifiedOnly={setVerifiedOnly}
          sortBy={sortBy}
          onChangeSortBy={setSortBy}
          totalCount={sortedMatches.length}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Discovering nearby verified technicians...</h3>
            <p className="text-xs text-slate-400">Scanning device compatibility, service radius, and shop availability</p>
          </div>
          <div className="space-y-3 max-w-lg mx-auto pt-4">
            <div className="h-28 bg-slate-200/70 rounded-3xl animate-pulse" />
            <div className="h-28 bg-slate-200/50 rounded-3xl animate-pulse" />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-6 bg-rose-50 rounded-3xl border border-rose-200 text-center space-y-4 max-w-md mx-auto my-8">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">We couldn't load technicians.</h3>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchDiscovery(maxDistance)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedMatches.length === 0 && (
        <TechnicianEmptyState
          onExpandSearch={() => handleDistanceChange(50)}
          onChangeLocation={onBack}
        />
      )}

      {/* Results List */}
      {!isLoading && !error && sortedMatches.length > 0 && (
        <div className="space-y-4">
          {sortedMatches.map((match) => (
            <TechnicianDiscoveryCard
              key={match.technician.userId}
              match={match}
              onViewShop={() => setSelectedMatch(match)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
