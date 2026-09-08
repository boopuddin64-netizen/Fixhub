import React, { useState } from 'react';
import { RepairJob, RepairQuote } from '../../types';
import { ApiClient } from '../../api/client';
import {
  ShieldCheck,
  CreditCard,
  Building2,
  PhoneCall,
  Lock,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';

interface EscrowPaymentModalProps {
  job: RepairJob;
  quote?: RepairQuote;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const EscrowPaymentModal: React.FC<EscrowPaymentModalProps> = ({
  job,
  quote,
  onClose,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<'CARD' | 'BANK_TRANSFER' | 'USSD'>('CARD');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amount = job.finalAmount || job.originalQuoteAmount || quote?.totalAmount || 0;

  const handlePay = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const idempotencyKey = `idemp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 1. Initialize Paystack payment server-side with authoritative amounts
      const initRes = await ApiClient.initializePayment(job.id, idempotencyKey, method);
      if (!initRes.success || !initRes.reference) {
        throw new Error(initRes.error || 'Failed to initialize payment with Paystack.');
      }

      const reference = initRes.reference;

      // 2. Server-side verification with Paystack
      const verifyRes = await ApiClient.verifyPayment({ reference });
      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Payment could not be confirmed.');
      }

      onPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment could not be confirmed.');
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="escrow-payment-modal"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Fix Hub Secure Checkout</h3>
              <p className="text-xs text-emerald-300 font-medium">Payment Protected via Paystack</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount & Device Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Device & Model:</span>
              <span className="text-xs font-bold text-slate-900">{job.deviceBrand} {job.deviceModel}</span>
            </div>
            {quote && (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Parts Cost ({quote.partsQuality?.replace('_', ' ') || 'Standard'}):</span>
                  <span className="font-semibold text-slate-800">₦{quote.partsCost.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Labor & Calibration:</span>
                  <span className="font-semibold text-slate-800">₦{quote.laborCost.toLocaleString()}</span>
                </div>
                {quote.warrantyDays > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Warranty Included:</span>
                    <span className="font-semibold text-emerald-700">{quote.warrantyDays} Days Protection</span>
                  </div>
                )}
              </>
            )}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total Authoritative Amount:</span>
              <span className="text-xl font-extrabold text-blue-700">₦{amount.toLocaleString()}</span>
            </div>
          </div>

          {/* How Payment Protection Works Notice */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Lock className="w-3.5 h-3.5" />
              <span>Fix Hub Payment Protection:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Funds are held securely by Fix Hub until your device is repaired, tested, and handed over at pickup.
            </p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Payment Method (Paystack NGN)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod('CARD')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  method === 'CARD'
                    ? 'border-blue-600 bg-blue-50/60 font-bold text-blue-700 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-xs">Debit Card</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('BANK_TRANSFER')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  method === 'BANK_TRANSFER'
                    ? 'border-blue-600 bg-blue-50/60 font-bold text-blue-700 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-xs">Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('USSD')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  method === 'USSD'
                    ? 'border-blue-600 bg-blue-50/60 font-bold text-blue-700 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span className="text-xs">USSD</span>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            id="confirm-escrow-payment-btn"
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{isProcessing ? 'Confirming Payment with Paystack...' : `Pay ₦${amount.toLocaleString()} via Paystack`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
