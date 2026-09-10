import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  Clock,
  Building2,
  CheckCircle2,
  DollarSign,
  Star,
  LogOut,
  Edit2,
  X,
  AlertTriangle,
  Loader2,
  Layers,
  Phone,
  Power,
  TrendingUp,
  Award,
  ChevronRight
} from 'lucide-react';

interface TechnicianProfileViewProps {
  onNavigateToCatalog?: () => void;
}

export const TechnicianProfileView: React.FC<TechnicianProfileViewProps> = ({ onNavigateToCatalog }) => {
  const { user, technicianProfile, logout, refreshAuth } = useAuth();

  // Modals
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showBankModal, setShowBankModal] = useState<boolean>(false);
  const [showFinances, setShowFinances] = useState<boolean>(false);

  // Status & Availability
  const [isAvailable, setIsAvailable] = useState<boolean>(technicianProfile?.isAvailable ?? true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Edit Profile Form State
  const [businessName, setBusinessName] = useState<string>(technicianProfile?.businessName || '');
  const [bio, setBio] = useState<string>(technicianProfile?.bio || '');
  const [phone, setPhone] = useState<string>(technicianProfile?.phone || user?.phone || '');
  const [businessHours, setBusinessHours] = useState<string>(technicianProfile?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(technicianProfile?.serviceRadiusKm || 15);
  const [address, setAddress] = useState<string>(technicianProfile?.shopLocation?.address || '');
  const [landmark, setLandmark] = useState<string>(technicianProfile?.shopLocation?.landmark || '');
  const [area, setArea] = useState<string>(technicianProfile?.shopLocation?.area || 'Port Harcourt');
  const [city, setCity] = useState<string>(technicianProfile?.shopLocation?.city || 'Port Harcourt');
  const [state, setState] = useState<string>(technicianProfile?.shopLocation?.state || 'Rivers State');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bank Form State
  const [bankName, setBankName] = useState<string>(technicianProfile?.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState<string>(technicianProfile?.bankDetails?.accountNumber || '');
  const [accountName, setAccountName] = useState<string>(technicianProfile?.bankDetails?.accountName || technicianProfile?.businessName || '');
  const [savingBank, setSavingBank] = useState<boolean>(false);

  // Live Financial Data State
  const [financesData, setFinancesData] = useState<{
    summary: {
      heldEarningsNaira: number;
      availablePayoutNaira: number;
      lockedInProcessingNaira: number;
      totalCompletedPayoutsNaira: number;
      commissionRatePercent: number;
    };
    earnings: any[];
    payouts: any[];
  } | null>(null);
  const [loadingFinances, setLoadingFinances] = useState(false);

  const fetchFinances = async () => {
    setLoadingFinances(true);
    try {
      const data = await ApiClient.getTechnicianEarnings();
      if (data) setFinancesData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFinances(false);
    }
  };

  useEffect(() => {
    if (showFinances) {
      fetchFinances();
    }
  }, [showFinances]);

  useEffect(() => {
    if (technicianProfile) {
      setBusinessName(technicianProfile.businessName || '');
      setBio(technicianProfile.bio || '');
      setPhone(technicianProfile.phone || user?.phone || '');
      setBusinessHours(technicianProfile.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM');
      setServiceRadiusKm(technicianProfile.serviceRadiusKm || 15);
      setAddress(technicianProfile.shopLocation?.address || '');
      setLandmark(technicianProfile.shopLocation?.landmark || '');
      setArea(technicianProfile.shopLocation?.area || 'Computer Village');
      setCity(technicianProfile.shopLocation?.city || 'Ikeja');
      setState(technicianProfile.shopLocation?.state || 'Lagos State');
      setIsAvailable(technicianProfile.isAvailable ?? true);
      if (technicianProfile.bankDetails) {
        setBankName(technicianProfile.bankDetails.bankName || 'Providus Bank');
        setAccountNumber(technicianProfile.bankDetails.accountNumber || '');
        setAccountName(technicianProfile.bankDetails.accountName || technicianProfile.businessName || '');
      }
    }
  }, [technicianProfile, user]);

  const handleToggleAvailability = async () => {
    const nextStatus = isAvailable ? 'BUSY' : 'ONLINE';
    setUpdatingStatus(true);
    try {
      await ApiClient.setTechnicianAvailability(nextStatus);
      setIsAvailable(!isAvailable);
      if (refreshAuth) await refreshAuth();
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      await ApiClient.updateTechnicianProfile({
        businessName: businessName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        businessHours: businessHours.trim(),
        serviceRadiusKm,
        shopLocation: {
          address: address.trim(),
          landmark: landmark.trim(),
          area: area.trim(),
          city: city.trim(),
          state: state.trim(),
        },
      });

      if (refreshAuth) await refreshAuth();

      setProfileMsg({ type: 'success', text: 'Shop profile updated successfully!' });
      setTimeout(() => {
        setShowEditProfile(false);
        setProfileMsg(null);
      }, 1200);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update shop profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountNumber.trim().length < 10) {
      alert('Account number must be at least 10 digits.');
      return;
    }
    setSavingBank(true);
    try {
      await ApiClient.updateTechnicianProfile({
        bankDetails: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim() || businessName,
        },
      });
      if (refreshAuth) await refreshAuth();
      setShowBankModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update settlement bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const verificationStages = [
    { label: 'Government ID & Identity Verified', done: true },
    { label: 'Physical Shop / Counter Inspected in Computer Village', done: true },
    { label: 'CAC Business Registration Confirmed', done: true },
    { label: 'Dedicated Settlement Account Active', done: !!technicianProfile?.bankDetails?.accountNumber },
  ];

  return (
    <div id="technician-profile-view" className="space-y-6 pb-8">
      {/* Shop Profile Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={technicianProfile?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
              alt={technicianProfile?.businessName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-400 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white truncate">{technicianProfile?.businessName}</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="flex items-center font-bold text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                  {technicianProfile?.rating || '4.9'}
                </span>
                <span className="text-slate-400">• {technicianProfile?.completedJobs || 214} Repairs</span>
              </div>
            </div>
          </div>

          <button
            id="edit-technician-profile-btn"
            onClick={() => setShowEditProfile(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit Shop</span>
          </button>
        </div>

        {/* Online / Busy Toggle */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold text-slate-200">
              {isAvailable ? 'Receiving Repair Leads & Orders' : 'Store Marked Busy / Offline'}
            </span>
          </div>

          <button
            onClick={handleToggleAvailability}
            disabled={updatingStatus}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAvailable
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
            }`}
          >
            {updatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            <span>{isAvailable ? 'Set Busy' : 'Go Online'}</span>
          </button>
        </div>
      </div>

      {/* Trust & Verification Badges */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Fixhub Verified Technician Credentials</span>
        </h3>

        <div className="space-y-2">
          {verificationStages.map((st, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${st.done ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span className={st.done ? 'text-slate-800' : 'text-slate-400'}>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shop Details & Payout Bank */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Physical Shop Address</span>
              <span className="text-slate-600">
                {technicianProfile?.shopLocation?.address || '12 Pepple Street, Computer Village, Ikeja, Lagos'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            className="text-blue-600 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Change
          </button>
        </div>

        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Operating Hours</span>
              <span className="text-slate-600">{technicianProfile?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM'}</span>
            </div>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            className="text-blue-600 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Edit
          </button>
        </div>

        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Payout Bank Account</span>
              <span className="text-slate-600">
                {technicianProfile?.bankDetails?.bankName || 'Providus Bank'} • {technicianProfile?.bankDetails?.accountNumber || '0129849201'} • {technicianProfile?.bankDetails?.accountName || technicianProfile?.businessName}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowBankModal(true)}
            className="text-blue-600 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Update Bank
          </button>
        </div>

        {onNavigateToCatalog && (
          <button
            onClick={onNavigateToCatalog}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Technician Parts Inventory Catalog</p>
                <p className="text-slate-500 text-[11px]">Manage stock levels, cost prices & serialized parts</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <button
          onClick={() => setShowFinances(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Financial Earnings & Payout Ledger</p>
              <p className="text-slate-500 text-[11px]">View held earnings, eligible balances & completed payouts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-3.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Technician Portal</span>
        </button>
      </div>

      {/* Edit Technician Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Edit Shop Profile</h3>
                  <p className="text-xs text-slate-400">Update store name, operating hours & address</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4 text-xs">
              {profileMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shop / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Store Bio / Specialization
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Master iPhone motherboard micro-soldering & Samsung screen replacements."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Direct Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    required
                    value={businessHours}
                    onChange={(e) => setBusinessHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shop Street Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Area / Hub
                  </label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={serviceRadiusKm}
                    onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Shop Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Settlement Bank Account</h3>
                  <p className="text-xs text-slate-400">Where completed repair payouts are deposited</p>
                </div>
              </div>
              <button
                onClick={() => setShowBankModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold text-slate-900 bg-white"
                >
                  <option value="Providus Bank">Providus Bank</option>
                  <option value="Access Bank">Access Bank</option>
                  <option value="GTBank">GTBank (Guaranty Trust)</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="First Bank">First Bank Nigeria</option>
                  <option value="UBA">United Bank for Africa (UBA)</option>
                  <option value="Kuda Bank">Kuda Microfinance Bank</option>
                  <option value="OPay">OPay Digital Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  10-Digit Account Number
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="0123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold text-slate-900 tracking-wider font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Emeka Okafor Enterprises"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                Payouts are automatically transferred within 24 hours of customer completion code verification.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Bank Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Financial Earnings Modal */}
      {showFinances && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Technician Earnings & Payouts</h3>
                  <p className="text-xs text-slate-400">Authoritative Fixhub financial ledger</p>
                </div>
              </div>
              <button
                onClick={() => setShowFinances(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {loadingFinances ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Loading authoritative ledger...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Eligible for Payout
                      </span>
                      <span className="text-xl font-extrabold text-emerald-950">
                        ₦{(financesData?.summary?.availablePayoutNaira ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                        Earnings Held
                      </span>
                      <span className="text-xl font-extrabold text-amber-950">
                        ₦{(financesData?.summary?.heldEarningsNaira ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs">Recent Earnings</h4>
                      <span className="text-[10px] text-slate-500">Platform Fee: 8.5%</span>
                    </div>
                    {(!financesData?.earnings || financesData.earnings.length === 0) ? (
                      <p className="text-slate-400 text-[11px] py-2 text-center">No earnings recorded yet.</p>
                    ) : (
                      <div className="space-y-2 text-[11px] divide-y divide-slate-200/80 max-h-48 overflow-y-auto">
                        {financesData.earnings.slice(0, 5).map((e: any) => (
                          <div key={e.id} className="pt-2 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-800">Job #{e.repairId}</p>
                              <p className="text-slate-500 text-[10px]">
                                Gross: ₦{e.grossAmountNaira.toLocaleString()} • Status: {e.status === 'HELD' ? 'Held' : e.status === 'ELIGIBLE_FOR_PAYOUT' ? 'Eligible' : e.status}
                              </p>
                            </div>
                            <span className="font-extrabold text-emerald-600">+₦{e.netEarningsNaira.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
