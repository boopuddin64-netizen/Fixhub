import React, { useState } from 'react';
import { Mail, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import { OtpVerificationModal } from './OtpVerificationModal';

export const EmailVerificationBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  if (!user || user.emailVerified || dismissed) {
    return null;
  }

  const handleStartVerify = async () => {
    try {
      await ApiClient.requestEmailVerification();
      setShowOtpModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send verification email.');
    }
  };

  const handleVerifyOtp = async (code: string) => {
    await ApiClient.confirmEmailVerification(code);
    await refreshUser();
    setShowOtpModal(false);
  };

  const handleResend = async () => {
    await ApiClient.requestEmailVerification();
  };

  return (
    <>
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-blue-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-2 overflow-hidden">
          <Mail className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">
            Verify your email address (<strong className="text-white">{user.email}</strong>) to receive repair receipts and payout confirmations.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleStartVerify}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
          >
            Verify Now
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-500/20 rounded-md text-amber-400 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showOtpModal && (
        <OtpVerificationModal
          title="Verify Your Email Address"
          subtitle="We've sent a 6-digit code to your email address."
          targetAddress={user.email}
          type="email"
          onVerify={handleVerifyOtp}
          onResend={handleResend}
          onClose={() => setShowOtpModal(false)}
          isBlocking={false}
        />
      )}
    </>
  );
};
