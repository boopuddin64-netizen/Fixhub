import React, { useState } from 'react';
import { RepairRequest, PartsQuality } from '../../types';
import { ApiClient } from '../../api/client';
import {
  DollarSign,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface QuoteBuilderModalProps {
  request: RepairRequest;
  onClose: () => void;
  onQuoteSubmitted: () => void;
}

export const CONTROLLED_PARTS_QUALITIES: { id: PartsQuality; label: string; desc: string }[] = [
  { id: 'ORIGINAL_MANUFACTURER', label: 'Original / Manufacturer', desc: 'Direct OEM unit or authentic service pack' },
  { id: 'OEM', label: 'OEM Specification', desc: 'Manufactured to OEM specifications' },
  { id: 'PREMIUM_AFTERMARKET', label: 'Premium Aftermarket', desc: 'High-grade replacement part with tested reliability' },
  { id: 'STANDARD_AFTERMARKET', label: 'Standard Aftermarket', desc: 'Standard replacement part' },
  { id: 'USED_REFURBISHED', label: 'Used / Refurbished', desc: 'Tested working pulled or refurbished unit' },
  { id: 'UNKNOWN', label: 'Unknown / To Be Inspected', desc: 'Grade unknown until physical inspection' },
];

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  request,
  onClose,
  onQuoteSubmitted,
}) => {
  const [partsCost, setPartsCost] = useState<number>(35000);
  const [laborCost, setLaborCost] = useState<number>(15000);
  const [diagnosticCost, setDiagnosticCost] = useState<number>(0);
  const [partsQuality, setPartsQuality] = useState<PartsQuality>('PREMIUM_AFTERMARKET');
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [validityDays, setValidityDays] = useState<number>(7);
  const [notes, setNotes] = useState<string>('Display replacement with touch sensitivity and calibration testing included.');
  const [limitationsOrConditions, setLimitationsOrConditions] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalAmount = Number(partsCost || 0) + Number(laborCost || 0) + Number(diagnosticCost || 0);
  const platformFee = Math.round(totalAmount * 0.085);
  const netEarnings = totalAmount - platformFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await ApiClient.submitQuote({
        requestId: request.id,
        partsCost: Number(partsCost),
        laborCost: Number(laborCost),
        diagnosticCost: Number(diagnosticCost || 0),
        partsQuality,
        estimatedTimeHours: Number(estimatedHours),
        warrantyDays: Number(warrantyDays),
        validityDays: Number(validityDays),
        notes,
        limitationsOrConditions,
      });
      onQuoteSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit quote');
      setIsSubmitting(false);
    }
  };

  return (
    <div id="quote-builder-modal" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900">Prepare Transparent Quote</h3>
            <p className="text-xs text-slate-500">
              For {request.deviceBrand} {request.deviceModel} ({(request.issues || []).join(', ')})
            </p>
          </div>
          <button id="close-quote-builder-btn" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transparent Cost Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Parts Fee (₦)
              </label>
              <input
                id="quote-parts-cost-input"
                type="number"
                min="0"
                step="500"
                value={partsCost}
                onChange={(e) => setPartsCost(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Labor Fee (₦)
              </label>
              <input
                id="quote-labor-cost-input"
                type="number"
                min="0"
                step="500"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Diagnostic (₦)
              </label>
              <input
                id="quote-diagnostic-cost-input"
                type="number"
                min="0"
                step="500"
                value={diagnosticCost}
                onChange={(e) => setDiagnosticCost(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Parts Quality Tier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Part Quality Specification
              </label>
              <span className="text-[11px] text-slate-500">Controlled Transparency</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTROLLED_PARTS_QUALITIES.map((q) => (
                <button
                  type="button"
                  key={q.id}
                  id={`parts-quality-opt-${q.id.toLowerCase()}`}
                  onClick={() => setPartsQuality(q.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    partsQuality === q.id
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-bold text-xs">{q.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{q.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Turnaround, Warranty & Validity */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Turnaround (Hrs)
              </label>
              <input
                id="quote-hours-input"
                type="number"
                min="1"
                max="72"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Warranty (Days)
              </label>
              <input
                id="quote-warranty-input"
                type="number"
                min="14"
                max="365"
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Valid For
              </label>
              <select
                id="quote-validity-select"
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>

          {/* Technician Advice Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Shop Notes & Advice to Customer
            </label>
            <textarea
              id="quote-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Free internal cleaning and screen protector included."
            />
          </div>

          {/* Limitations or Conditions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Optional Conditions / Limitations
            </label>
            <input
              id="quote-conditions-input"
              type="text"
              value={limitationsOrConditions}
              onChange={(e) => setLimitationsOrConditions(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Warranty excludes accidental drops and liquid immersion."
            />
          </div>

          {/* Transparent Net Earnings Summary */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Customer Quote Total:</span>
              <span className="font-bold text-white text-sm">₦{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Fix Hub Marketplace Fee (8.5%):</span>
              <span>-₦{platformFee.toLocaleString()}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
              <span>Your Estimated Payout:</span>
              <span>₦{netEarnings.toLocaleString()}</span>
            </div>
          </div>

          <button
            id="submit-quote-btn"
            type="submit"
            disabled={isSubmitting || totalAmount <= 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting Authoritative Quote...' : `Submit Quote for ₦${totalAmount.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
};
