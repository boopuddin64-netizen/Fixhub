import React, { useState, useEffect } from 'react';
import { RepairRequest, RepairQuote, MatchScoreResult, TechnicianProfile, RepairJob } from '../../types';
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
  AlertCircle,
  X,
  Shield,
  ThumbsDown,
} from 'lucide-react';

interface QuoteComparisonViewProps {
  request: RepairRequest;
  onSelectQuoteToPay: (quote: RepairQuote, job: RepairJob) => void;
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

  const [confirmedJob, setConfirmedJob] = useState<RepairJob | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<RepairQuote | null>(null);
  const [quoteToConfirm, setQuoteToConfirm] = useState<RepairQuote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [reqData, quotesData] = await Promise.all([
        ApiClient.getRepairRequest(request.id).catch(() => null),
        ApiClient.getQuotesForRequest(request.id).catch(() => []),
      ]);

      const fetchedQuotes = Array.isArray(quotesData) && quotesData.length > 0
        ? quotesData
        : (reqData && Array.isArray(reqData.quotes) ? reqData.quotes : []);

      setQuotes(fetchedQuotes);
      if (reqData && Array.isArray(reqData.matchedTechnicians)) {
        setMatchedTechs(reqData.matchedTechnicians);
      }
    } catch (err) {
      console.error('Error fetching quotes data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [request]);

  const handleConfirmAcceptance = async () => {
    if (!quoteToConfirm) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await ApiClient.acceptQuote(request.id, quoteToConfirm.id);
      if (response && response.job) {
        setConfirmedJob(response.job);
        setSelectedQuote(quoteToConfirm);
        setQuoteToConfirm(null);
      } else {
        throw new Error('Failed to create booking.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during booking creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectQuote = async (quote: RepairQuote) => {
    if (!confirm(`Decline quote from ${quote.businessName || 'this technician'}?`)) return;
    try {
      await ApiClient.rejectQuote(quote.id);
      setActionSuccessMsg(`Quote from ${quote.businessName || 'technician'} declined.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject quote.');
    }
  };

  const getQualityBadge = (q: string) => {
    switch (q) {
      case 'ORIGINAL_MANUFACTURER':
      case 'ORIGINAL_OEM':
        return { label: 'Original / OEM', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'OEM':
        return { label: 'OEM Spec', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'PREMIUM_AFTERMARKET':
        return { label: 'Premium Aftermarket', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
      case 'STANDARD_AFTERMARKET':
        return { label: 'Standard Aftermarket', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'USED_REFURBISHED':
      case 'REFURBISHED':
        return { label: 'Used / Refurbished', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'UNKNOWN':
      default:
        return { label: 'Unknown / Inspected', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  if (confirmedJob && selectedQuote) {
    return (
      <div id="booking-confirmed-panel" className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-md p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-950">Repair Booking Confirmed!</h2>
          <p className="text-sm text-slate-600">
            Your repair request with <span className="font-bold text-slate-900">{selectedQuote.businessName}</span> is now confirmed and scheduled.
          </p>
        </div>

        {/* Reference and Security Codes Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking Reference</span>
            <span className="font-mono text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              {confirmedJob.bookingRef || `FH-${confirmedJob.id.toUpperCase().slice(-6)}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Drop-off Code</span>
              <span className="font-mono font-bold text-base text-slate-800">{confirmedJob.dropOffCode}</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Pickup Code</span>
              <span className="font-mono font-bold text-base text-slate-800">{confirmedJob.pickupCode}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Keep these security codes private. Provide them to the technician at the shop during device check-in and pickup.
          </p>
        </div>

        {/* Financial & Job Overview */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Authoritative Quote Summary</h4>
          <div className="p-4 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Device & Issue:</span>
              <span className="font-semibold text-slate-900">{request.deviceBrand} {request.deviceModel}</span>
            </div>
            <div className="flex justify-between">
              <span>Assigned Technician:</span>
              <span className="font-semibold text-slate-900">{selectedQuote.businessName}</span>
            </div>
            <div className="flex justify-between">
              <span>Part Quality:</span>
              <span className="font-semibold text-slate-900">{getQualityBadge(selectedQuote.partsQuality).label}</span>
            </div>
            <div className="flex justify-between">
              <span>Warranty Protection:</span>
              <span className="font-semibold text-emerald-700 font-bold">{selectedQuote.warrantyDays} Days Guarantee</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-slate-900">
              <span>Total Binding Price:</span>
              <span className="text-blue-700 text-base">₦{selectedQuote.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Informative Security/Payment notice */}
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-800 text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>Payment Protected via Paystack:</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Pay securely for your repair with Paystack. Your payment is held pending physical device handover, bench diagnosis, and customer pickup confirmation.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2 pt-2">
          <button
            id="proceed-to-payment-btn"
            onClick={() => onSelectQuoteToPay(selectedQuote, confirmedJob)}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Proceed to Paystack Checkout</span>
          </button>
          
          <button
            id="pay-later-btn"
            onClick={onBack}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer"
          >
            <span>Complete Later (View Active Repairs)</span>
          </button>
        </div>
      </div>
    );
  }

  const activeQuotes = quotes.filter((q) => q.status !== 'WITHDRAWN');

  return (
    <div id="quote-comparison-view" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1 cursor-pointer bg-transparent border-none"
          >
            ← Back to Repairs
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">
              {request.deviceBrand} {request.deviceModel}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/30 text-cyan-300 font-semibold border border-blue-400/30">
              {(request.issues || []).length} Issue(s)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {request.customerLocation?.address || request.customerLocation?.city || 'Rivers State'} {request.customerLocation?.area ? `(${request.customerLocation.area})` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-cyan-400">{activeQuotes.length}</span>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Quote(s) Received</p>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Received Quotes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span>Submitted Quotes from Technicians</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">Authoritative price & warranty guarantee</span>
        </div>

        {activeQuotes.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto animate-pulse">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Waiting for Nearby Technicians to Quote...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Certified technicians in your area have been notified of your request. Quotes will appear here transparently.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeQuotes.map((quote) => {
              const qualityBadge = getQualityBadge(quote.partsQuality);
              const isRejected = quote.status === 'REJECTED';
              return (
                <div
                  key={quote.id}
                  id={`quote-card-${quote.id}`}
                  className={`bg-white p-5 rounded-2xl border-2 transition-all shadow-sm space-y-4 ${
                    isRejected ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-blue-500'
                  }`}
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
                          {quote.distanceKm !== undefined && (
                            <span className="text-[11px] text-slate-400">• {quote.distanceKm} km</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${qualityBadge.color}`}>
                      {qualityBadge.label}
                    </span>
                  </div>

                  {/* Price & Transparent Parts Breakdown */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-600">
                    {quote.items && quote.items.length > 0 ? (
                      <div className="space-y-1.5 pb-2 border-b border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Itemized Verified Parts ({quote.items.length})
                        </span>
                        {quote.items.map((item, idx) => {
                          const partName = item.partNameSnapshot || (item as any).partName || 'Replacement Part';
                          const rawQuality = item.qualitySnapshot || (item as any).quality || quote.partsQuality || 'PREMIUM_AFTERMARKET';
                          const qualityFormatted = typeof rawQuality === 'string' ? rawQuality.replace(/_/g, ' ') : 'Standard';
                          const unitPrice = item.unitPriceSnapshot ?? (item as any).unitPriceNaira ?? 0;
                          const quantity = item.quantity || 1;
                          const subtotal = item.subtotal ?? (item as any).subtotalNaira ?? (unitPrice * quantity);

                          return (
                            <div key={item.id || idx} className="flex justify-between items-start text-[11px]">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-slate-900 truncate">
                                  {partName}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span>{qualityFormatted}</span>
                                  {quantity > 1 && <span>• Qty: {quantity}</span>}
                                  <span>• ₦{unitPrice.toLocaleString()} ea</span>
                                </div>
                              </div>
                              <span className="font-bold text-slate-800 shrink-0">
                                ₦{subtotal.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Parts Cost:</span>
                        <span className="font-semibold text-slate-800">₦{quote.partsCost.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-0.5">
                      <span>Labor & Bench:</span>
                      <span className="font-semibold text-slate-800">₦{quote.laborCost.toLocaleString()}</span>
                    </div>
                    {quote.diagnosticCost > 0 && (
                      <div className="flex justify-between">
                        <span>Diagnostic Fee:</span>
                        <span className="font-semibold text-slate-800">₦{quote.diagnosticCost.toLocaleString()}</span>
                      </div>
                    )}
                    {quote.otherCost && quote.otherCost > 0 ? (
                      <div className="flex justify-between">
                        <span>Other / Misc:</span>
                        <span className="font-semibold text-slate-800">₦{quote.otherCost.toLocaleString()}</span>
                      </div>
                    ) : null}
                    <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                      <span>Total Guaranteed Price:</span>
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
                      <span className="block text-[10px] text-emerald-700 font-semibold uppercase">Warranty Guarantee</span>
                      <span className="font-bold text-emerald-800">{quote.warrantyDays} Days Covered</span>
                    </div>
                  </div>

                  {quote.notes && (
                    <p className="text-xs text-slate-600 italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                      "{quote.notes}"
                    </p>
                  )}

                  {quote.limitationsOrConditions && (
                    <p className="text-[11px] text-slate-500 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                      <strong>Conditions:</strong> {quote.limitationsOrConditions}
                    </p>
                  )}

                  {/* Accept or Decline Buttons */}
                  {isRejected ? (
                    <div className="p-2.5 bg-slate-100 text-slate-500 text-center text-xs font-semibold rounded-xl">
                      Quote Declined
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        id={`reject-quote-btn-${quote.id}`}
                        onClick={() => handleRejectQuote(quote)}
                        className="py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        id={`accept-quote-btn-${quote.id}`}
                        onClick={() => setQuoteToConfirm(quote)}
                        className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Accept & Book</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal Before Acceptance */}
      {quoteToConfirm && (
        <div id="quote-acceptance-modal" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Confirm Quote Acceptance</h3>
              <button onClick={() => setQuoteToConfirm(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are about to accept the repair quote from <strong className="text-slate-900">{quoteToConfirm.businessName}</strong>.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between font-bold text-slate-900 text-sm">
                <span>Binding Price:</span>
                <span className="text-blue-700">₦{quoteToConfirm.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Part Quality:</span>
                <span>{getQualityBadge(quoteToConfirm.partsQuality).label}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Warranty:</span>
                <span className="text-emerald-700 font-bold">{quoteToConfirm.warrantyDays} Days</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Turnaround:</span>
                <span>~{quoteToConfirm.estimatedTimeHours} Hour(s)</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span>Next Step: Booking & Security PINs</span>
              </p>
              <p className="leading-relaxed">
                Acceptance immediately generates a confirmed Booking Reference with secure Drop-off and Pickup verification PINs.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuoteToConfirm(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-booking-submission-btn"
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAcceptance}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

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

