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
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { TechnicianProfile } from '../../types';

interface TechnicianVerificationModalProps {
  technicianProfile: TechnicianProfile | null;
  onClose: () => void;
  onSuccess: (updatedProfile: TechnicianProfile) => void;
}

export const TechnicianVerificationModal: React.FC<TechnicianVerificationModalProps> = ({
  technicianProfile,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'id' | 'location' | 'business' | 'bank'>('id');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [idType, setIdType] = useState<string>('NIN');
  const [idNumber, setIdNumber] = useState<string>('');
  const [idFileName, setIdFileName] = useState<string>('');

  const [shopAddress, setShopAddress] = useState<string>(
    technicianProfile?.shopLocation?.address || ''
  );
  const [landmark, setLandmark] = useState<string>(technicianProfile?.landmark || '');
  const [shopPhotoName, setShopPhotoName] = useState<string>('');

  const [cacNumber, setCacNumber] = useState<string>('');
  const [cacFileName, setCacFileName] = useState<string>('');

  const status = technicianProfile?.verificationStatus;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {};

      if (activeTab === 'id') {
        if (!idNumber.trim()) {
          throw new Error('Please provide your identity document number.');
        }
        payload.verificationStatus = {
          ...status,
          identityVerified: true,
          basic: true,
        };
      } else if (activeTab === 'location') {
        if (!shopAddress.trim()) {
          throw new Error('Please enter your verified workshop or shop counter address.');
        }
        payload.shopLocation = {
          ...(technicianProfile?.shopLocation || { lat: 6.598, lng: 3.344, state: 'Lagos', city: 'Ikeja' }),
          address: shopAddress.trim(),
        };
        payload.landmark = landmark.trim();
        payload.verificationStatus = {
          ...status,
          locationConfirmed: true,
        };
      } else if (activeTab === 'business') {
        if (!cacNumber.trim()) {
          throw new Error('Please provide your CAC RC or BN registration number.');
        }
        payload.verificationStatus = {
          ...status,
          businessVerified: true,
        };
      }

      const res = await ApiClient.updateTechnicianProfile(payload);
      if (res.profile) {
        setSuccessMsg('Verification information submitted successfully!');
        onSuccess(res.profile);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit verification document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Technician Verification System</h3>
              <p className="text-xs text-slate-400">4-Track Trust & Credential Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50/80 p-1.5 text-center text-xs font-bold text-slate-600 gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('id'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'id' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">Identity</span>
            {status?.identityVerified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('location'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'location' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">Shop</span>
            {status?.locationConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('business'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'business' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">CAC</span>
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
            <span className="truncate">Bank</span>
            {status?.payoutVerified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
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

          {/* TAB 1: ID VERIFICATION */}
          {activeTab === 'id' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Government ID Type</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NIN">National Identification Number (NIN)</option>
                  <option value="DRIVERS_LICENSE">FRSC Driver's License</option>
                  <option value="VOTERS_CARD">INEC Voter's Card (PVC)</option>
                  <option value="PASSPORT">Nigerian International Passport</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ID Number / Slip Reference</label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 11-digit NIN or License Number"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Upload ID Document / Slip</label>
                <label className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600 font-bold">
                    {idFileName || 'Click or drag photo of ID document'}
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG or PDF up to 10MB</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIdFileName(e.target.files[0].name);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Submit Identity Track</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SHOP LOCATION VERIFICATION */}
          {activeTab === 'location' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Physical Shop / Counter Address</label>
                <input
                  type="text"
                  required
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="e.g. 12 Pepple Street, Computer Village, Ikeja"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Prominent Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Beside Slot Plaza, Opposite Under-Bridge"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Submit Shop Track</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CAC BUSINESS VERIFICATION */}
          {activeTab === 'business' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">CAC Registration (RC / BN Number)</label>
                <input
                  type="text"
                  required
                  value={cacNumber}
                  onChange={(e) => setCacNumber(e.target.value)}
                  placeholder="e.g. BN-3489201 or RC-1290382"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">CAC Certificate Document</label>
                <label className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600 font-bold">
                    {cacFileName || 'Click to upload CAC Certificate'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCacFileName(e.target.files[0].name);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Submit CAC Track</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: BANK DETAILS */}
          {activeTab === 'bank' && (
            <div className="space-y-3.5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Settlement Account Status
                </h4>
                <p className="text-[11px] text-emerald-700">
                  {technicianProfile?.bankDetails?.accountNumber
                    ? `Active NUBAN: ${technicianProfile.bankDetails.bankName} - ${technicianProfile.bankDetails.accountNumber} (${technicianProfile.bankDetails.accountName})`
                    : 'No settlement account attached yet. Setup your verified bank account in the Shop Profile.'}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
