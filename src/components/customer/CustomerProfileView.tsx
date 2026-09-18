import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  User,
  ShieldCheck,
  Smartphone,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Lock,
  Edit2,
  Star,
  HelpCircle,
  X,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  Download,
  Trash2,
  KeyRound,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';

interface CustomerProfileViewProps {
  onViewWarranties: () => void;
  onOpenDevicesManager?: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  onViewWarranties,
  onOpenDevicesManager,
}) => {
  const { user, customerProfile, logout, isBorrowedDevice, refreshAuth } = useAuth();

  // Modals & Drawers
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showAccountSecurity, setShowAccountSecurity] = useState<boolean>(false);
  const [showReviews, setShowReviews] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Edit Profile Form State
  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [address, setAddress] = useState<string>(customerProfile?.defaultLocation?.address || '');
  const [landmark, setLandmark] = useState<string>(customerProfile?.defaultLocation?.landmark || '');
  const [city, setCity] = useState<string>(customerProfile?.defaultLocation?.city || 'Port Harcourt');
  const [state, setState] = useState<string>(customerProfile?.defaultLocation?.state || 'Rivers State');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Account & Security State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [savingPassword, setSavingPassword] = useState<boolean>(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exportingData, setExportingData] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  // Email/Phone verification in Security Modal
  const [emailVerifying, setEmailVerifying] = useState<boolean>(false);
  const [emailVerifyMsg, setEmailVerifyMsg] = useState<string | null>(null);

  // My Reviews State
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
    }
    if (customerProfile) {
      setAddress(customerProfile.defaultLocation?.address || '');
      setLandmark(customerProfile.defaultLocation?.landmark || '');
      setCity(customerProfile.defaultLocation?.city || 'Port Harcourt');
      setState(customerProfile.defaultLocation?.state || 'Rivers State');
    }
  }, [user, customerProfile]);

  const loadMyReviews = async () => {
    setLoadingReviews(true);
    try {
      const list = await ApiClient.getMyReviews();
      setMyReviews(list);
    } catch {
      setMyReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleOpenReviews = () => {
    setShowReviews(true);
    loadMyReviews();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      await ApiClient.updateCustomerProfile({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        city: city.trim(),
        state: state.trim(),
      });

      if (refreshAuth) {
        await refreshAuth();
      }

      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => {
        setShowEditProfile(false);
        setProfileMsg(null);
      }, 1200);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (!/\d/.test(newPassword)) {
      setPasswordMsg({ type: 'error', text: 'New password must contain at least one number.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await ApiClient.changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });

      setPasswordMsg({ type: 'success', text: res.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordMsg(null);
      }, 3000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const data = await ApiClient.exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fixhub-account-data-${user?.id || 'export'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export account data: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await ApiClient.deleteAccount();
      logout();
    } catch (err: any) {
      alert('Failed to delete account: ' + (err.message || 'Please contact support'));
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSendEmailVerification = async () => {
    setEmailVerifying(true);
    setEmailVerifyMsg(null);
    try {
      const res = await ApiClient.requestEmailVerification();
      setEmailVerifyMsg(res.message || 'Verification link sent to your email.');
    } catch (err: any) {
      setEmailVerifyMsg(err.message || 'Failed to send verification email.');
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard?.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div id="customer-profile-view" className="space-y-6 pb-8">
      {/* Profile Header & Card */}
      <div id="profile-card" className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-extrabold text-2xl text-white shadow-md shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white truncate">{user?.name || 'Customer'}</h2>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <p className="text-xs text-cyan-300 mt-0.5">{user?.phone || 'No phone set'}</p>
          </div>
        </div>
        <button
          id="edit-customer-profile-btn"
          onClick={() => setShowEditProfile(true)}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>

      {/* Borrowed Phone Notice (Conditional) */}
      {isBorrowedDevice && (
        <div id="borrowed-phone-protection-banner" className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Borrowed Phone Protection Active</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            You are logged into Fixhub from a temporary/borrowed device. Your token will expire quickly and will not persist locally.
          </p>
          <button
            onClick={logout}
            className="text-xs font-bold text-amber-900 underline hover:text-black cursor-pointer"
          >
            Wipe Session & Log Out Now
          </button>
        </div>
      )}

      {/* SECTION 1: MY FIXHUB */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
          MY FIXHUB
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          {onOpenDevicesManager && (
            <button
              id="profile-my-devices-btn"
              onClick={onOpenDevicesManager}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">My Saved Devices</p>
                  <p className="text-xs text-slate-500">Manage registered phones, colors & storage</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          )}

          <button
            id="profile-warranties-btn"
            onClick={onViewWarranties}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Repair Passport & Warranties</p>
                <p className="text-xs text-slate-500">View coverage and service records</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            id="profile-my-reviews-btn"
            onClick={handleOpenReviews}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">My Reviews</p>
                <p className="text-xs text-slate-500">View ratings and comments for completed repairs</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* SECTION 2: ACCOUNT & SECURITY */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
          ACCOUNT & SECURITY
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            id="profile-account-security-btn"
            onClick={() => setShowAccountSecurity(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Account & Security</p>
                <p className="text-xs text-slate-500">Password & verified account details</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* SECTION 3: SUPPORT */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
          SUPPORT
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            id="profile-help-support-btn"
            onClick={() => setShowHelp(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Help & Support</p>
                <p className="text-xs text-slate-500">Payment, repair, warranty & FAQs</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* Final Action: Log Out */}
      <div className="pt-2">
        <button
          id="profile-logout-btn"
          onClick={logout}
          className="w-full py-3.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Fixhub</span>
        </button>
      </div>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* 1. Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-cyan-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Edit Customer Profile</h3>
                  <p className="text-xs text-slate-400">Update personal contact details and address</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
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
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default Address / Street
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 45 Aba Road, Garrison"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Opposite Genesis"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-900"
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
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Account & Security Modal */}
      {showAccountSecurity && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Account & Security</h3>
                  <p className="text-xs text-slate-400">Password & verified account details</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountSecurity(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6 max-h-[32rem] overflow-y-auto text-xs">
              {/* Verified Account Details */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Verified Credentials</span>
                </h4>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  {/* Email row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-500">Email Address</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
                    </div>
                    {user?.emailVerified ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                      </span>
                    ) : (
                      <button
                        onClick={handleSendEmailVerification}
                        disabled={emailVerifying}
                        className="px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {emailVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        Verify Email
                      </button>
                    )}
                  </div>
                  {emailVerifyMsg && (
                    <p className="text-[11px] text-blue-600 bg-blue-50 p-2 rounded-lg">{emailVerifyMsg}</p>
                  )}

                  {/* Phone row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-500">Phone Number</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.phone || 'Not provided'}</p>
                    </div>
                    {user?.phoneVerified ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wide shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Account ID row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-500">Customer Identifier</p>
                      <p className="text-[11px] font-mono font-semibold text-slate-700 truncate">{user?.id}</p>
                    </div>
                    <button
                      onClick={handleCopyId}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                      title="Copy Customer ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Management */}
              <form onSubmit={handleChangePassword} className="space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>Update Password</span>
                </h4>

                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {passwordMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Current Password (Optional if signed in via Google)
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      New Password (min 8 chars, 1 number)
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Save New Password</span>
                  </button>
                </div>
              </form>

              {/* Data & Privacy (NDPR Compliance) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <span>Privacy & NDPR Data Rights</span>
                </h4>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Export My Account Data</p>
                      <p className="text-[11px] text-slate-500">Download complete repair, passport, and profile history (JSON)</p>
                    </div>
                    <button
                      onClick={handleExportData}
                      disabled={exportingData}
                      className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {exportingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200">
                    {!showDeleteConfirm ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-rose-800">Delete Account & Erasure</p>
                          <p className="text-[11px] text-slate-500">Permanently delete personal profile and revoke access</p>
                        </div>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-3 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-rose-900">Are you absolutely sure?</p>
                        <p className="text-[11px] text-rose-800 leading-relaxed">
                          This will immediately delete your customer profile and revoke session access. This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deletingAccount}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            {deletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>Yes, Delete Account</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. My Reviews Modal */}
      {showReviews && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">My Reviews</h3>
                  <p className="text-xs text-slate-400">View ratings and comments for completed repairs</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviews(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {loadingReviews ? (
                <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Loading review history...</span>
                </div>
              ) : myReviews.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                  <Star className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">No reviews submitted yet</p>
                  <p className="text-slate-400">You can rate technicians once your repairs are marked as completed.</p>
                </div>
              ) : (
                myReviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{rev.repairSummary || 'Completed Repair'}</span>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 italic">"{rev.comment || 'No written comment.'}"</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Repair
                      </span>
                      <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Help & Support Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Help & Support</h3>
                  <p className="text-xs text-slate-400">Payment, repair, warranty & FAQs</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[28rem] overflow-y-auto text-xs">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>How Fixhub Payment Protection Works</span>
                </div>
                <p className="text-blue-800 text-[11px] leading-relaxed">
                  Your repair payment is held securely in Fixhub until repair completion. The technician is only eligible for payout after your device is verified and completed at pickup.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-900">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>90-Day Digital Warranty & Repair Passport</span>
                </div>
                <p className="text-purple-800 text-[11px] leading-relaxed">
                  Every completed repair receives a tamper-proof Digital Repair Passport. Serialized replacement parts carry a 90-day active warranty guarantee.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-sm text-slate-900">Frequently Asked Questions</h4>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Where do I drop off my device?</p>
                  <p className="text-slate-600 text-[11px]">
                    Once your payment is confirmed, drop off your phone directly at the technician's verified shop or use our verified courier pickup.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">What if additional issues are found during diagnosis?</p>
                  <p className="text-slate-600 text-[11px]">
                    Technicians MUST submit a formal additional diagnosis with photos and part costs. No extra work can proceed without your explicit 1-tap approval in the app!
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-emerald-900">Need direct human assistance?</p>
                  <p className="text-[11px] text-emerald-800">Support desk open Mon - Sat 8 AM - 6 PM</p>
                </div>
                <a
                  href="tel:08000FIXHUB"
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Us</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
