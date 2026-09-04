import React, { useState } from 'react';
import { RepairJob, RepairQuote } from '../../types';
import { ApiClient } from '../../api/client';
import {
  ShieldCheck,
  CreditCard,
  Building2,
  PhoneCall,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X
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

  const amount = job.finalAmount || job.originalQuoteAmount;

  const handlePaySandbox = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // 1. Create intent
      const intentRes = await ApiClient.createPaymentIntent(job.id, idempotencyKey, method);
      const paymentId = intentRes.payment.id;
      const txRef = intentRes.payment.transactionRef;

      // 2. Complete escrow verification
      await ApiClient.verifyMockPayment(paymentId, txRef);

      onPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment processing failed');
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
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Fix Hub Escrow Checkout</h3>
              <p className="text-xs text-cyan-300 font-medium">100% Buyer Protection Guaranteed</p>
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
                  <span>Parts Cost ({quote.partsQuality.replace('_', ' ')}):</span>
                  <span className="font-semibold text-slate-800">₦{quote.partsCost.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Labor & Calibration:</span>
                  <span className="font-semibold text-slate-800">₦{quote.laborCost.toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total Escrow Amount:</span>
              <span className="text-xl font-extrabold text-blue-700">₦{amount.toLocaleString()}</span>
            </div>
          </div>

          {/* How Escrow Works Notice */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Lock className="w-3.5 h-3.5" />
              <span>How Your Money is Protected:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Your funds are securely locked in Fix Hub Escrow. The technician is only paid AFTER you physically test and approve your repaired phone.
            </p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Choose Payment Method
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

          {/* Paystack Test Provider Form Display */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Payment Gateway:</span>
              <span className="font-semibold text-slate-700">Paystack Sandbox Mode (NGN)</span>
            </div>

            {method === 'CARD' && (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Test Card:</span>
                  <p className="font-mono font-semibold text-slate-800">4084 0800 0000 0000</p>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Expiry: 12/28</span>
                  <span>CVV: 408</span>
                </div>
              </div>
            )}

            {method === 'BANK_TRANSFER' && (
              <div className="space-y-1 text-xs">
                <span className="text-slate-500">Virtual Dedicated Account:</span>
                <p className="font-mono font-bold text-slate-900 text-sm">9920 182 910</p>
                <p className="text-[11px] text-slate-600">Bank: Providus Bank / FixHub Escrow</p>
              </div>
            )}

            {method === 'USSD' && (
              <div className="space-y-1 text-xs">
                <span className="text-slate-500">Dial on your phone:</span>
                <p className="font-mono font-bold text-blue-700 text-sm">*737*000*8492#</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            id="confirm-escrow-payment-btn"
            onClick={handlePaySandbox}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{isProcessing ? 'Securing Funds in Escrow...' : `Lock ₦${amount.toLocaleString()} in Escrow`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
