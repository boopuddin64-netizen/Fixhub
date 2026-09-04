import React, { useState, useEffect } from 'react';
import { RepairRequest, RepairQuote, MatchScoreResult, TechnicianProfile } from '../../types';
import { ApiClient } from '../../api/client';
import {
  Wrench,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
  ChevronDown,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface QuoteComparisonViewProps {
  request: RepairRequest;
  onSelectQuoteToPay: (quote: RepairQuote) => void;
  onBack: () => void;
}

export const QuoteComparisonView: React.FC<QuoteComparisonViewProps> = ({
  request,
  onSelectQuoteToPay,
  onBack,
}) => {
  const [quotes, setQuotes] = useState<RepairQuote[]>([]);
  const [matchedTechs, setMatchedTechs] = useState<MatchScoreResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTechProfile, setSelectedTechProfile] = useState<TechnicianProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reqData = await ApiClient.getRepairRequest(request.id);
        setQuotes(reqData.quotes || []);

        const matches = await ApiClient.matchTechnicians({
          customerLocation: request.customerLocation,
          deviceBrand: request.deviceBrand,
          deviceModel: request.deviceModel,
          issues: request.issues,
        });
        setMatchedTechs(matches);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [request]);

  const getQualityBadgeColor = (q: string) => {
    switch (q) {
      case 'ORIGINAL_OEM':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PREMIUM_AFTERMARKET':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'STANDARD_AFTERMARKET':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="quote-comparison-view" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1 cursor-pointer"
          >
            ← Back to Repairs
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">
              {request.deviceBrand} {request.deviceModel}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/30 text-cyan-300 font-semibold border border-blue-400/30">
              {request.issues.length} Issue(s)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {request.customerLocation.address} ({request.customerLocation.area || request.customerLocation.city})
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-cyan-400">{quotes.length}</span>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Quote(s) Received</p>
        </div>
      </div>

      {/* Received Quotes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span>Submitted Quotes from Technicians</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">Compare price & warranty</span>
        </div>

        {quotes.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto animate-pulse">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Waiting for Nearby Technicians to Quote...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                We notified 5 certified technicians in Computer Village & nearby areas. Quotes typically arrive within 10-20 minutes.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                id={`quote-card-${quote.id}`}
                className="bg-white p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all shadow-sm space-y-4"
              >
                {/* Technician Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={quote.technicianAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
                      alt={quote.technicianName}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">{quote.businessName}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="flex items-center text-xs font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 mr-0.5" />
                          {quote.technicianRating}
                        </span>
                        <span className="text-[11px] text-slate-400">({quote.technicianReviewsCount} reviews)</span>
                        <span className="text-[11px] text-slate-400">• {quote.distanceKm} km</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getQualityBadgeColor(quote.partsQuality)}`}>
                    {quote.partsQuality.replace('_', ' ')}
                  </span>
                </div>

                {/* Price Breakdown */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Parts Cost:</span>
                    <span className="font-semibold text-slate-800">₦{quote.partsCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor & Diagnostics:</span>
                    <span className="font-semibold text-slate-800">₦{quote.laborCost.toLocaleString()}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Total Fixed Price:</span>
                    <span className="text-blue-700 text-base">₦{quote.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Turnaround & Warranty Guarantee */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-100/70 rounded-lg">
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Estimated Time</span>
                    <span className="font-bold text-slate-800">{quote.estimatedTimeHours} Hour(s)</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                    <span className="block text-[10px] text-emerald-700 font-semibold uppercase">Warranty Period</span>
                    <span className="font-bold text-emerald-800">{quote.warrantyDays} Days Covered</span>
                  </div>
                </div>

                {quote.notes && (
                  <p className="text-xs text-slate-500 italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                    "{quote.notes}"
                  </p>
                )}

                {/* Accept Button */}
                <button
                  id={`accept-quote-btn-${quote.id}`}
                  onClick={() => onSelectQuoteToPay(quote)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Accept Quote & Pay in Escrow</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matched Nearby Technicians (Ranked by Match Score) */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>Ranked Nearby Technicians (Match Score)</span>
            </h3>
            <p className="text-xs text-slate-500">Fair multi-factor ranking based on distance, rating & verified quote accuracy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {matchedTechs.map((match) => (
            <div
              key={match.technicianId}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{match.technician.businessName}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{match.technician.shopLocation.address} (~{match.distanceKm} km)</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {match.totalScore} Match
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {match.technician.rating} ({match.technician.completedJobs} jobs)
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-semibold">{match.technician.quoteAccuracyScore}% Quote Accuracy</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
