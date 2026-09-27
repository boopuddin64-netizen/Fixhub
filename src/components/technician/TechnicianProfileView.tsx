import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import { NIGERIAN_BANKS, NigerianBank, getBankCodeByName, getBankNameByCode } from '../../data/nigerianBanks';
import { SearchableBankSelect } from '../common/SearchableBankSelect';
import { TechnicianVerificationModal } from './TechnicianVerificationModal';
import { WheelPicker } from '../common/WheelPicker';
import { forceResetViewportZoom } from '../../utils/mobileViewport';
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
  ChevronRight,
  User,
  Lock,
  KeyRound,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

interface TechnicianProfileViewProps {}

export const TechnicianProfileView: React.FC<TechnicianProfileViewProps> = () => {
  const { user, technicianProfile, logout, refreshUser, refreshAuth } = useAuth();

  // Modals
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showBankModal, setShowBankModal] = useState<boolean>(false);
  const [showFinances, setShowFinances] = useState<boolean>(false);
  const [openedBankFromFinances, setOpenedBankFromFinances] = useState<boolean>(false);

  // Bank Account Security Verification
  const hasExistingBank = Boolean(technicianProfile?.bankDetails?.accountNumber);
  const [isBankUnlocked, setIsBankUnlocked] = useState<boolean>(false);
  const [showBankVerificationModal, setShowBankVerificationModal] = useState<boolean>(false);
  const [bankOtp, setBankOtp] = useState<string>('');
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [bankOtpMsg, setBankOtpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bankOtpDevCode, setBankOtpDevCode] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const [verificationModalTab, setVerificationModalTab] = useState<'id' | 'location' | 'business' | 'bank'>('id');

  const openVerificationModal = (tab: 'id' | 'location' | 'business' | 'bank' = 'id') => {
    setVerificationModalTab(tab);
    setShowVerificationModal(true);
  };

  const handleTriggerBankSetup = (fromFinances = false) => {
    if (fromFinances) {
      setOpenedBankFromFinances(true);
      setShowFinances(false);
    }

    // Gating rule: Government ID verification must come first before bank account setup
    if (!technicianProfile?.verificationStatus?.identityVerified) {
      openVerificationModal('id');
      return;
    }

    // If bank account was already set up and is not yet verified/unlocked in this session:
    if (hasExistingBank && !isBankUnlocked) {
      setBankOtp('');
      setBankOtpMsg(null);
      setShowBankVerificationModal(true);
      handleRequestOtpCode();
    } else {
      setShowBankModal(true);
    }
  };

  const handleRequestOtpCode = async () => {
    setIsRequestingOtp(true);
    setBankOtpMsg(null);
    try {
      const res = await ApiClient.requestBankChangeOtp();
      if (res.success) {
        setBankOtpMsg({ type: 'success', text: res.message });
        if (res.devCode) {
          setBankOtpDevCode(res.devCode);
        }
        setOtpCountdown(60);
      }
    } catch (err: any) {
      setBankOtpMsg({ type: 'error', text: err.message || 'Failed to send security verification code.' });
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyBankOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankOtp || bankOtp.trim().length < 6) {
      setBankOtpMsg({ type: 'error', text: 'Please enter all 6 digits of the verification code.' });
      return;
    }
    setIsVerifyingOtp(true);
    setBankOtpMsg(null);
    try {
      const res = await ApiClient.verifyBankChangeOtp(bankOtp.trim());
      if (res.success) {
        setIsBankUnlocked(true);
        setShowBankVerificationModal(false);
        setShowBankModal(true);
      } else {
        setBankOtpMsg({ type: 'error', text: 'Verification failed. Please check the code.' });
      }
    } catch (err: any) {
      setBankOtpMsg({ type: 'error', text: err.message || 'Verification failed. Please check the code.' });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowBankVerificationModal(false);
    if (openedBankFromFinances) {
      setShowFinances(true);
      setOpenedBankFromFinances(false);
    }
    forceResetViewportZoom();
  };

  const handleCloseBankModal = () => {
    setShowBankModal(false);
    if (openedBankFromFinances) {
      setShowFinances(true);
      setOpenedBankFromFinances(false);
    }
    forceResetViewportZoom();
  };

  // Status & Availability
  const [isAvailable, setIsAvailable] = useState<boolean>(technicianProfile?.isAvailable ?? true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);

  // Edit Profile Form State
  const [businessName, setBusinessName] = useState<string>(technicianProfile?.businessName || '');
  const [bio, setBio] = useState<string>(technicianProfile?.bio || '');
  const [phone, setPhone] = useState<string>(technicianProfile?.phone || user?.phone || '');
  const [businessHours, setBusinessHours] = useState<string>(technicianProfile?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number | ''>(technicianProfile?.serviceRadiusKm || 15);
  const [address, setAddress] = useState<string>(technicianProfile?.shopLocation?.address || '');
  const [landmark, setLandmark] = useState<string>(technicianProfile?.shopLocation?.landmark || '');
  const [area, setArea] = useState<string>(technicianProfile?.shopLocation?.area || 'Port Harcourt');
  const [city, setCity] = useState<string>(technicianProfile?.shopLocation?.city || 'Port Harcourt');
  const [state, setState] = useState<string>(technicianProfile?.shopLocation?.state || 'Rivers State');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bank Form State
  const [bankName, setBankName] = useState<string>(technicianProfile?.bankDetails?.bankName || 'Providus Bank');
  const [bankCode, setBankCode] = useState<string>(technicianProfile?.bankDetails?.bankCode || '101');
  const [accountNumber, setAccountNumber] = useState<string>(technicianProfile?.bankDetails?.accountNumber || '');
  const [accountName, setAccountName] = useState<string>(technicianProfile?.bankDetails?.accountName || technicianProfile?.businessName || '');
  const [savingBank, setSavingBank] = useState<boolean>(false);
  const [isResolvingAccount, setIsResolvingAccount] = useState<boolean>(false);
  const [accountResolved, setAccountResolved] = useState<boolean>(!!technicianProfile?.bankDetails?.accountNumber);
  const [bankError, setBankError] = useState<string | null>(null);
  const [banksList, setBanksList] = useState<NigerianBank[]>(NIGERIAN_BANKS);

  const handleResolveAccount = async (num: string, bCode: string) => {
    const cleanNum = num.replace(/\D/g, '');
    if (cleanNum.length !== 10 || !bCode) {
      setAccountResolved(false);
      return;
    }
    setIsResolvingAccount(true);
    setBankError(null);
    try {
      const res = await ApiClient.resolveBankAccount(cleanNum, bCode);
      if (res && res.accountName) {
        setAccountName(res.accountName.toUpperCase());
        setAccountResolved(true);
        setBankError(null);
      } else {
        throw new Error('Could not resolve account name. Check parameters or try again.');
      }
    } catch (err: any) {
      setAccountResolved(false);
      setBankError(err.message || 'Could not resolve account name. Please verify your 10-digit account number and bank.');
    } finally {
      setIsResolvingAccount(false);
    }
  };

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
    ApiClient.getBanks().then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        const seen = new Set<string>();
        const unique: NigerianBank[] = [];
        for (const b of res) {
          if (b.code && !seen.has(b.code)) {
            seen.add(b.code);
            unique.push(b);
          }
        }
        if (unique.length > 0) {
          setBanksList(unique);
        }
      }
    }).catch(() => {});
  }, []);

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
        setBankCode(technicianProfile.bankDetails.bankCode || getBankCodeByName(technicianProfile.bankDetails.bankName || '') || '101');
        setAccountNumber(technicianProfile.bankDetails.accountNumber || '');
        setAccountName(technicianProfile.bankDetails.accountName || technicianProfile.businessName || '');
      }
    }
  }, [technicianProfile, user]);

  const handleToggleAvailability = async () => {
    const nextStatus = isAvailable ? 'BUSY' : 'AVAILABLE';
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
    setBankError(null);
    if (accountNumber.trim().length < 10) {
      setBankError('Account number must be at least 10 digits.');
      return;
    }
    setSavingBank(true);
    try {
      const resolvedCode = bankCode || getBankCodeByName(bankName) || '044';
      const resolvedName = getBankNameByCode(resolvedCode) || bankName;
      await ApiClient.updateTechnicianProfile({
        bankDetails: {
          bankName: resolvedName.trim(),
          bankCode: resolvedCode.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim() || businessName,
        },
      });
      if (refreshAuth) await refreshAuth();
      setIsBankUnlocked(false);
      handleCloseBankModal();
      forceResetViewportZoom();
    } catch (err: any) {
      setBankError(err.message || 'Failed to update settlement bank details');
      if (err.requiresVerification) {
        setIsBankUnlocked(false);
        handleCloseBankModal();
        setShowBankVerificationModal(true);
        handleRequestOtpCode();
      }
    } finally {
      setSavingBank(false);
    }
  };

  const isVerifiedPro = Boolean(
    technicianProfile?.isVerified ||
    (technicianProfile?.verificationStatus?.identityVerified &&
     technicianProfile?.verificationStatus?.locationConfirmed &&
     technicianProfile?.verificationStatus?.businessVerified)
  );

  const idDetails = (technicianProfile?.verificationStatus as any)?.idDetails;
  const cacDetails = (technicianProfile?.verificationStatus as any)?.cacDetails;

  const verificationStages: {
    track: 'id' | 'location' | 'business' | 'bank';
    label: string;
    sublabel?: string;
    done: boolean;
  }[] = [
    {
      track: 'id',
      label: 'Government ID & Identity Verified',
      sublabel: idDetails?.verifiedName ? `Verified: ${idDetails.verifiedName}` : undefined,
      done: Boolean(technicianProfile?.verificationStatus?.identityVerified),
    },
    {
      track: 'business',
      label: 'CAC Business Registration Confirmed',
      sublabel: cacDetails?.companyName ? `Registered: ${cacDetails.companyName}` : undefined,
      done: Boolean(technicianProfile?.verificationStatus?.businessVerified),
    },
    {
      track: 'location',
      label: 'Physical Shop / Counter Inspected in Computer Village',
      done: Boolean(technicianProfile?.verificationStatus?.locationConfirmed),
    },
    {
      track: 'bank',
      label: 'Dedicated Settlement Account Active',
      sublabel: technicianProfile?.bankDetails?.accountNumber
        ? `${technicianProfile.bankDetails.bankName} (${technicianProfile.bankDetails.accountNumber})`
        : !technicianProfile?.verificationStatus?.identityVerified
        ? 'Locked: Requires Government ID First'
        : undefined,
      done: !!technicianProfile?.bankDetails?.accountNumber,
    },
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
                {isVerifiedPro ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Verified Pro
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Verification Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                {technicianProfile?.reviewCount && technicianProfile.reviewCount > 0 && technicianProfile.rating ? (
                  <span className="flex items-center font-bold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                    {technicianProfile.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">New to Fixhub</span>
                )}
                <span className="text-slate-400">• {technicianProfile?.completedJobs || 0} Repairs</span>
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
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Fixhub Verified Technician Credentials</span>
          </h3>
          <button
            type="button"
            onClick={() => openVerificationModal('id')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/60 transition-colors cursor-pointer"
          >
            {isVerifiedPro ? 'View Credentials' : 'Manage Verification'}
          </button>
        </div>

        <div className="space-y-2.5">
          {verificationStages.map((st, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${st.done ? 'text-emerald-600' : 'text-slate-300'}`} />
                <div className="min-w-0">
                  <span className={`block font-semibold truncate ${st.done ? 'text-slate-900' : 'text-slate-500'}`}>
                    {st.label}
                  </span>
                  {st.sublabel && (
                    <span className={`text-[10px] block truncate ${st.done ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}`}>
                      {st.sublabel}
                    </span>
                  )}
                </div>
              </div>
              {!st.done && (
                <button
                  type="button"
                  onClick={() => {
                    if (st.track === 'bank') {
                      handleTriggerBankSetup(false);
                    } else {
                      openVerificationModal(st.track);
                    }
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg shrink-0 transition-colors cursor-pointer ${
                    st.track === 'bank' && !technicianProfile?.verificationStatus?.identityVerified
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  {st.track === 'id'
                    ? 'Verify ID'
                    : st.track === 'business'
                    ? 'Verify CAC'
                    : st.track === 'location'
                    ? 'Verify Shop'
                    : !technicianProfile?.verificationStatus?.identityVerified
                    ? 'Locked (Verify ID)'
                    : 'Link Bank'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Shop Details & Financial Overview */}
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
              <p className="text-slate-500 text-[11px]">View held earnings, payout settlement bank & completed payouts</p>
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
                  inputMode="text"
                  enterKeyHint="next"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Store Bio / Specialization
                </label>
                <textarea
                  rows={2}
                  inputMode="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Master iPhone motherboard micro-soldering & Samsung screen replacements."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Direct Phone Number
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    enterKeyHint="next"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="next"
                    required
                    value={businessHours}
                    onChange={(e) => setBusinessHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shop Street Address
                </label>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="next"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Area / Hub
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="next"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="done"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-base sm:text-sm font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Service Radius <span className="text-cyan-600 font-normal">({serviceRadiusKm || 15} km)</span>
                  </label>
                  <WheelPicker
                    id="tech-service-radius-picker"
                    theme="light"
                    unit="km"
                    options={[
                      { label: '5 km (Immediate Area)', value: 5 },
                      { label: '10 km (Port Harcourt Core)', value: 10 },
                      { label: '15 km (Greater City Area)', value: 15 },
                      { label: '20 km (Extended Suburbs)', value: 20 },
                      { label: '25 km (Outer LGA Boundary)', value: 25 },
                      { label: '30 km (Metropolitan Radius)', value: 30 },
                      { label: '50 km (All Rivers State)', value: 50 },
                    ]}
                    selectedValue={typeof serviceRadiusKm === 'number' ? serviceRadiusKm : 15}
                    onChange={(val) => setServiceRadiusKm(Number(val))}
                    ariaLabel="Select Technician Service Radius"
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
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
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
                onClick={handleCloseBankModal}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {hasExistingBank && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Security Verified • Payout bank modification is authorized for this session.</span>
                </div>
              )}

              {bankError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                  <span>{bankError}</span>
                  <button type="button" onClick={() => setBankError(null)} className="text-rose-600 hover:text-rose-800 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name
                </label>
                <SearchableBankSelect
                  id="tech-payout-bank-select"
                  banks={banksList}
                  selectedBankCode={bankCode}
                  selectedBankName={bankName}
                  theme="light"
                  onSelectBank={(code, name) => {
                    setBankCode(code);
                    setBankName(name);
                    if (accountNumber.length === 10) {
                      handleResolveAccount(accountNumber, code);
                    }
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    10-Digit NUBAN Account Number
                  </label>
                  {isResolvingAccount && (
                    <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  autoComplete="off"
                  required
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setAccountNumber(val);
                    if (val.length === 10) {
                      handleResolveAccount(val, bankCode);
                    } else {
                      setAccountResolved(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      forceResetViewportZoom();
                    }
                  }}
                  placeholder="0123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base font-semibold text-slate-900 tracking-wider font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Account Name
                  </label>
                  {accountResolved && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> NUBAN Verified
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="done"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      forceResetViewportZoom();
                    }
                  }}
                  placeholder="e.g. Emeka Okafor Enterprises"
                  className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-base font-semibold text-slate-900 ${
                    accountResolved ? 'border-emerald-400 bg-emerald-50/30 ring-emerald-500' : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                Payouts are automatically transferred within 24 hours of customer completion code verification.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseBankModal}
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

      {/* Bank Account Security Verification Modal */}
      {showBankVerificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Security Verification</h3>
                  <p className="text-xs text-slate-400">Protecting your payout bank account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseVerificationModal}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyBankOtp} className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Authorized Account Verification</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  To protect your repair earnings from fraud, modifying your payout bank account requires security verification. Please enter the 6-digit code sent to your registered account.
                </p>
              </div>

              {bankOtpMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    bankOtpMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {bankOtpMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="leading-snug">{bankOtpMsg.text}</span>
                </div>
              )}

              {bankOtpDevCode && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Security Code</span>
                    <span className="font-mono text-sm font-black text-blue-950 tracking-widest">{bankOtpDevCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBankOtp(bankOtpDevCode)}
                    className="text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
                  >
                    Autofill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={bankOtp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setBankOtp(val);
                    }}
                    placeholder="• • • • • •"
                    className="w-full text-center px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xl font-bold font-mono tracking-[0.35em] text-slate-900 bg-slate-50"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleRequestOtpCode}
                  disabled={otpCountdown > 0 || isRequestingOtp}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  {isRequestingOtp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend Code'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseVerificationModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || bankOtp.length < 6}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>Verify & Unlock</span>
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
                onClick={() => {
                  setShowFinances(false);
                  forceResetViewportZoom();
                }}
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
                  {/* Settlement / Payout Bank Account Details */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-slate-900 text-xs">Payout Settlement Bank</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTriggerBankSetup(true)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {technicianProfile?.bankDetails?.accountNumber ? (
                          <>
                            <Lock className="w-3 h-3 text-emerald-600" />
                            <span>Update Bank</span>
                          </>
                        ) : !technicianProfile?.verificationStatus?.identityVerified ? (
                          <>
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span className="text-amber-700">Locked (Verify ID)</span>
                          </>
                        ) : (
                          <span>Add Bank</span>
                        )}
                      </button>
                    </div>

                    {technicianProfile?.bankDetails?.accountNumber ? (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">
                            {technicianProfile.bankDetails.bankName || 'Providus Bank'}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified NUBAN
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-700 font-semibold tracking-wider">
                          {technicianProfile.bankDetails.accountNumber}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {technicianProfile.bankDetails.accountName || technicianProfile.businessName}
                        </p>
                      </div>
                    ) : !technicianProfile?.verificationStatus?.identityVerified ? (
                      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Government ID Verification Required First</span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          To protect platform funds and prevent fraud, you must verify your Driver's License, Voter's Card, or NIN before adding payout bank details.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowFinances(false);
                            openVerificationModal('id');
                          }}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify Government ID First</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                        <p className="text-[11px]">
                          Government ID verified! Link your Nigerian bank account to automatically receive completed repair earnings.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleTriggerBankSetup(true)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Link Payout Bank Account</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Technician 4-Track Verification Modal */}
      {showVerificationModal && (
        <TechnicianVerificationModal
          technicianProfile={technicianProfile}
          initialTab={verificationModalTab}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => {
            refreshUser?.();
            refreshAuth?.();
            setShowVerificationModal(false);
          }}
        />
      )}
    </div>
  );
};
