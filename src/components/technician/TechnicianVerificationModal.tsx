import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Building2,
  CreditCard,
  MapPin,
  FileText,
  Loader2,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { forceResetViewportZoom } from '../../utils/mobileViewport';

interface TechnicianVerificationModalProps {
  technicianProfile: TechnicianProfile | null;
  onClose: () => void;
  onSuccess: (updatedProfile: TechnicianProfile) => void;
  initialTab?: 'id' | 'location' | 'business' | 'bank';
}

export const TechnicianVerificationModal: React.FC<TechnicianVerificationModalProps> = ({
  technicianProfile,
  onClose,
  onSuccess,
  initialTab = 'id',
}) => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'id' | 'location' | 'business' | 'bank'>(initialTab);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Government ID states
  const [idType, setIdType] = useState<'DRIVERS_LICENSE' | 'VOTERS_CARD' | 'NIN'>('DRIVERS_LICENSE');
  const [idNumber, setIdNumber] = useState<string>('');
  const [dob, setDob] = useState<string>('');

  // Shop Location states
  const [shopAddress, setShopAddress] = useState<string>(
    technicianProfile?.shopLocation?.address || ''
  );
  const [landmark, setLandmark] = useState<string>(technicianProfile?.landmark || '');
  const [shopPhotoName, setShopPhotoName] = useState<string>('');

  // CAC Business Registration states
  const [cacNumber, setCacNumber] = useState<string>('');

  const status = technicianProfile?.verificationStatus;
  const idDetails = (status as any)?.idDetails;
  const cacDetails = (status as any)?.cacDetails;

  // Handle Automated Government ID Verification
  const handleVerifyGovernmentId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim()) {
      setErrorMsg('Please enter your document ID number.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await ApiClient.verifyGovernmentId({
        idType,
        idNumber: idNumber.trim(),
        dob: dob || undefined,
      });

      if (res.success && res.profile) {
        setSuccessMsg(
          res.message || `Government ID verified successfully for ${res.verifiedName}!`
        );
        onSuccess(res.profile);
        if (refreshUser) refreshUser();
        forceResetViewportZoom();
      } else {
        throw new Error('Verification could not be completed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify Government ID.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Automated CAC Verification
  const handleVerifyCac = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cacNumber.trim()) {
      setErrorMsg('Please enter your CAC RC or BN registration number.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await ApiClient.verifyCac({
        cacNumber: cacNumber.trim(),
      });

      if (res.success && res.profile) {
        setSuccessMsg(
          res.message || `CAC Business Registration verified for ${res.companyName}!`
        );
        onSuccess(res.profile);
        if (refreshUser) refreshUser();
        forceResetViewportZoom();
      } else {
        throw new Error('CAC verification could not be completed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify CAC registration.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Shop Location Submission
  const handleVerifyLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopAddress.trim()) {
      setErrorMsg('Please enter your workshop or shop counter address.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        shopLocation: {
          ...(technicianProfile?.shopLocation || { lat: 6.598, lng: 3.344, state: 'Lagos', city: 'Ikeja' }),
          address: shopAddress.trim(),
        },
        landmark: landmark.trim(),
        verificationStatus: {
          ...status,
          locationConfirmed: true,
        },
      };

      const res = await ApiClient.updateTechnicianProfile(payload);
      if (res.profile) {
        setSuccessMsg('Shop location information saved successfully!');
        onSuccess(res.profile);
        if (refreshUser) refreshUser();
        forceResetViewportZoom();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update shop location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Technician Verification System</h3>
              <p className="text-xs text-slate-400">Automated Identity & Registry Verification</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              forceResetViewportZoom();
            }}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50/80 p-1.5 text-center text-xs font-bold text-slate-600 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('id'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'id' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">Govt ID</span>
            {status?.identityVerified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('business'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'business' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">CAC Business</span>
            {status?.businessVerified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('bank'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'bank' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="truncate">Bank Payout</span>
            {status?.payoutVerified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('location'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'location' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">Shop Address</span>
            {status?.locationConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: GOVERNMENT ID VERIFICATION */}
          {activeTab === 'id' && (
            <div className="space-y-4">
              {status?.identityVerified ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Government ID Verified</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Document Type:</span>
                      <span className="font-bold text-slate-900">
                        {idDetails?.idType === 'DRIVERS_LICENSE'
                          ? "FRSC Driver's License"
                          : idDetails?.idType === 'VOTERS_CARD'
                          ? "INEC Voter's Card (PVC)"
                          : 'National Identification Number (NIN)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Verified Legal Name:</span>
                      <span className="font-bold text-emerald-700">
                        {idDetails?.verifiedName || user?.name}
                      </span>
                    </div>
                    {idDetails?.idNumberMasked && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">ID Reference:</span>
                        <span className="font-mono text-slate-900 font-semibold">{idDetails.idNumberMasked}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-emerald-700 font-medium">
                      ✓ Personal identity verified. Payout bank setup is unlocked.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bank')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Go to Bank Setup</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyGovernmentId} className="space-y-3.5">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Personal Identity Verification: </span>
                      Your Government ID verifies you as the personal account owner. It matches your legal name (<span className="font-bold text-blue-800">{user?.name || user?.email}</span>), not your shop name.
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Select Government ID Type</label>
                    <select
                      value={idType}
                      onChange={(e) => {
                        setIdType(e.target.value as any);
                        setIdNumber('');
                        setErrorMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    >
                      <option value="DRIVERS_LICENSE">FRSC Driver's License</option>
                      <option value="VOTERS_CARD">INEC Voter's Card (PVC)</option>
                      <option value="NIN">National Identity Number (NIN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {idType === 'DRIVERS_LICENSE'
                        ? "FRSC Driver's License Number"
                        : idType === 'VOTERS_CARD'
                        ? "INEC Voter Identification Number (VIN)"
                        : '11-Digit National Identification Number (NIN)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                          forceResetViewportZoom();
                        }
                      }}
                      placeholder={
                        idType === 'DRIVERS_LICENSE'
                          ? 'e.g. AAA12345AA01'
                          : idType === 'VOTERS_CARD'
                          ? 'e.g. 90F5B01234567890123'
                          : 'e.g. 12345678901'
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base tracking-wide"
                    />
                  </div>

                  {idType === 'DRIVERS_LICENSE' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Date of Birth (as registered on Driver's License)
                      </label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        forceResetViewportZoom();
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>{saving ? 'Verifying with Registry...' : 'Verify Government ID Instantly'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CAC BUSINESS VERIFICATION */}
          {activeTab === 'business' && (
            <div className="space-y-4">
              {status?.businessVerified ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>CAC Business Registration Verified</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Registered Entity Name:</span>
                      <span className="font-bold text-slate-900">
                        {cacDetails?.companyName || technicianProfile?.businessName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Registration Number:</span>
                      <span className="font-mono text-emerald-700 font-bold">{cacDetails?.rcNumber || 'ACTIVE'}</span>
                    </div>
                    {cacDetails?.classification && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Entity Classification:</span>
                        <span className="font-semibold text-slate-800">{cacDetails.classification}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    ✓ Verified business badge is active on your public profile and customer search cards.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleVerifyCac} className="space-y-3.5">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs leading-relaxed flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Business Registration Verification: </span>
                      Your CAC registration is matched directly against your Shop Business Name: <span className="font-bold text-indigo-800">"{technicianProfile?.businessName || 'Your Shop Name'}"</span>.
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      CAC Registration Number (RC / BN Number)
                    </label>
                    <input
                      type="text"
                      required
                      value={cacNumber}
                      onChange={(e) => setCacNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                          forceResetViewportZoom();
                        }
                      }}
                      placeholder="e.g. RC-1290382 or BN-3489201"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base tracking-wider font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Accepts Limited Companies (RC) and Registered Business Names (BN).
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        forceResetViewportZoom();
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                      <span>{saving ? 'Verifying with CAC...' : 'Verify CAC Business Instantly'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: BANK DETAILS GATE */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              {!status?.identityVerified ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Government ID Verification Required First</span>
                  </div>
                  <p className="text-xs leading-relaxed text-amber-900">
                    To comply with Nigerian anti-fraud regulations, you must verify your Driver's License, Voter's Card, or NIN before you can link a settlement bank account.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('id')}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Government ID First</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>Settlement Payout Account Status</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      {technicianProfile?.bankDetails?.accountNumber
                        ? `Linked Bank: ${technicianProfile.bankDetails.bankName} • Account: ${technicianProfile.bankDetails.accountNumber} (${technicianProfile.bankDetails.accountName})`
                        : 'Government ID verified! You are fully authorized to setup your settlement bank account in the Financial Earnings section.'}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        forceResetViewportZoom();
                      }}
                      className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SHOP LOCATION VERIFICATION */}
          {activeTab === 'location' && (
            <form onSubmit={handleVerifyLocation} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Physical Shop / Counter Address</label>
                <input
                  type="text"
                  required
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      forceResetViewportZoom();
                    }
                  }}
                  placeholder="e.g. 12 Pepple Street, Computer Village, Ikeja"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Prominent Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      forceResetViewportZoom();
                    }
                  }}
                  placeholder="e.g. Beside Slot Plaza, Opposite Under-Bridge"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Shop Front / Signboard Photo</label>
                <label className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600 font-bold">
                    {shopPhotoName || 'Click to upload shop front image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setShopPhotoName(e.target.files[0].name);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    forceResetViewportZoom();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Shop Location</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
