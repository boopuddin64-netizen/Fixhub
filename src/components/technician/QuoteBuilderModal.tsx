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
  Layers
} from 'lucide-react';

interface QuoteBuilderModalProps {
  request: RepairRequest;
  onClose: () => void;
  onQuoteSubmitted: () => void;
}

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  request,
  onClose,
  onQuoteSubmitted,
}) => {
  const [partsCost, setPartsCost] = useState<number>(45000);
  const [laborCost, setLaborCost] = useState<number>(15000);
  const [partsQuality, setPartsQuality] = useState<PartsQuality>('ORIGINAL_OEM');
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [notes, setNotes] = useState<string>('Original OLED assembly with true-tone calibration included.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalAmount = Number(partsCost || 0) + Number(laborCost || 0);
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
        partsQuality,
        estimatedTimeHours: Number(estimatedHours),
        warrantyDays: Number(warrantyDays),
        notes,
      });
      onQuoteSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit quote');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900">Create Transparent Quote</h3>
            <p className="text-xs text-slate-500">
              For {request.deviceBrand} {request.deviceModel} ({request.issues.join(', ')})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Parts Cost (₦)
              </label>
              <input
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
                Labor & Diagnostics (₦)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Parts Quality Tier */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Parts Grade & Quality Tier
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'ORIGINAL_OEM', label: 'Original OEM / Pull' },
                { id: 'PREMIUM_AFTERMARKET', label: 'Premium Hard OLED / Grade A' },
                { id: 'STANDARD_AFTERMARKET', label: 'Standard Incell / Grade B' },
                { id: 'REFURBISHED', label: 'Refurbished Original' },
              ].map((q) => (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => setPartsQuality(q.id as PartsQuality)}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left cursor-pointer transition-all ${
                    partsQuality === q.id
                      ? 'border-blue-600 bg-blue-50/60 font-bold text-blue-700 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Turnaround & Warranty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Turnaround Time (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Warranty Guarantee (Days)
              </label>
              <input
                type="number"
                min="14"
                max="365"
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Technician Advice Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Shop Notes & Advice to Customer
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Clean dust from speaker mesh included for free."
            />
          </div>

          {/* Net Earnings Summary */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Customer Total (Escrow):</span>
              <span className="font-bold text-white text-sm">₦{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Fix Hub Platform Fee (8.5%):</span>
              <span>-₦{platformFee.toLocaleString()}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
              <span>Your Net Payout:</span>
              <span>₦{netEarnings.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || totalAmount <= 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting Quote...' : `Send Quote for ₦${totalAmount.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
};
