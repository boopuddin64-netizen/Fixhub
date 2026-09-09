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
  CheckCircle2,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export interface PaystackCheckoutModalProps {
  job: RepairJob;
  quote?: RepairQuote;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

type CheckoutStep = 'REVIEW' | 'INITIALIZING' | 'CHECKOUT' | 'VERIFYING' | 'CONFIRMED' | 'FAILED';

export const PaystackCheckoutModal: React.FC<PaystackCheckoutModalProps> = ({
  job,
  quote,
  onClose,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<'CARD' | 'BANK_TRANSFER' | 'USSD'>('CARD');
  const [step, setStep] = useState<CheckoutStep>('REVIEW');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  const amount = job.finalAmount || job.originalQuoteAmount || quote?.totalAmount || 0;

  // Step 1: Initialize Paystack transaction server-side
  const handleInitialize = async () => {
    setStep('INITIALIZING');
    setErrorMsg(null);
    try {
      const idempotencyKey = `idemp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const initRes = await ApiClient.initializePayment(job.id, idempotencyKey, method);

      if (!initRes.success || !initRes.reference) {
        throw new Error(initRes.error || 'Failed to initialize Paystack checkout.');
      }

      setPaymentRef(initRes.reference);
      setAuthUrl(initRes.authorizationUrl || null);
      setAccessCode(initRes.accessCode || null);
      setStep('CHECKOUT');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize payment session.');
      setStep('FAILED');
    }
  };

  // Step 2: Customer authorizes & verifies transaction server-side
  const handleVerify = async () => {
    if (!paymentRef) return;
    setStep('VERIFYING');
    setErrorMsg(null);
    try {
      const verifyRes = await ApiClient.verifyPayment({ reference: paymentRef });
      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Payment verification pending or failed at Paystack.');
      }
      setStep('CONFIRMED');
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment could not be verified by server.');
      setStep('FAILED');
    }
  };

  return (
    <div
      id="paystack-checkout-modal"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Fix Hub Secure Checkout</h3>
              <p className="text-xs text-blue-300 font-medium">Payment Handled by Paystack</p>
            </div>
          </div>
          {step !== 'VERIFYING' && step !== 'INITIALIZING' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === 'REVIEW' && (
            <div className="space-y-4">
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

              {/* Protection Notice */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-800">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Fix Hub Payment Protection:</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Your payment is processed securely via Paystack and held by the platform until you test and confirm your completed repair.
                </p>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Paystack Channel
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

              {/* Proceed to Checkout */}
              <button
                id="initialize-paystack-btn"
                onClick={handleInitialize}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Pay ₦{amount.toLocaleString()} with Paystack</span>
              </button>
            </div>
          )}

          {/* STEP: INITIALIZING */}
          {step === 'INITIALIZING' && (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Preparing Secure Paystack Session...</h4>
                <p className="text-xs text-slate-500 mt-1">Generating authoritative payment transaction & reference tokens.</p>
              </div>
            </div>
          )}

          {/* STEP: CHECKOUT (Interactive Paystack Handoff) */}
          {step === 'CHECKOUT' && paymentRef && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Transaction Reference:</span>
                  <span className="font-mono text-cyan-300 font-bold bg-slate-800 px-2 py-0.5 rounded">{paymentRef}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Channel:</span>
                  <span className="font-bold text-slate-200">{method}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs font-semibold text-slate-300">Amount Due:</span>
                  <span className="text-lg font-extrabold text-emerald-400">₦{amount.toLocaleString()}</span>
                </div>
              </div>

              {method === 'CARD' && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Paystack Card Authorization</span>
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Card transactions in sandbox/test mode are authorized via Paystack.
                  </p>
                </div>
              )}

              {method === 'BANK_TRANSFER' && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2.5 text-xs">
                  <p className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Paystack Dedicated Virtual Account</span>
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-blue-100 space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank:</span>
                      <span className="font-bold text-slate-800">Wema Bank / Titan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account No:</span>
                      <span className="font-bold text-blue-700">9901847291</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Beneficiary:</span>
                      <span className="font-bold text-slate-800">Fix Hub / Paystack</span>
                    </div>
                  </div>
                </div>
              )}

              {authUrl && (
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <span>Open Paystack Hosted Checkout</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                id="verify-paystack-btn"
                onClick={handleVerify}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify Payment with Paystack</span>
              </button>
            </div>
          )}

          {/* STEP: VERIFYING */}
          {step === 'VERIFYING' && (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Verifying Payment with Paystack...</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Enforcing cryptographic integrity, amount matching, and booking state transitions.
                </p>
              </div>
            </div>
          )}

          {/* STEP: CONFIRMED */}
          {step === 'CONFIRMED' && (
            <div className="p-6 text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Payment Confirmed!</h4>
                <p className="text-xs text-slate-600 mt-1">
                  ₦{amount.toLocaleString()} received via Paystack. Your repair booking is officially confirmed.
                </p>
              </div>
              <button
                id="view-booked-repair-btn"
                onClick={onPaymentSuccess}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Proceed to Drop-Off Handoff</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP: FAILED */}
          {step === 'FAILED' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Payment Was Not Completed</span>
                </p>
                <p>{errorMsg || 'We could not verify payment confirmation from Paystack.'}</p>
              </div>
              <button
                onClick={() => setStep('REVIEW')}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Checkout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
