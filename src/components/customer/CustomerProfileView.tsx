import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  User,
  ShieldCheck,
  MapPin,
  Smartphone,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Lock,
  Edit2,
  Bell,
  Star,
  HelpCircle,
  X,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  FileText,
  Clock
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
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
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

  // Notification Preferences State
  const [repairUpdatesNotif, setRepairUpdatesNotif] = useState<boolean>(
    customerProfile?.notificationPreferences?.repairUpdates ?? true
  );
  const [paymentUpdatesNotif, setPaymentUpdatesNotif] = useState<boolean>(
    customerProfile?.notificationPreferences?.paymentUpdates ?? true
  );
  const [promotionalNotif, setPromotionalNotif] = useState<boolean>(
    customerProfile?.notificationPreferences?.promotional ?? false
  );
  const [savingNotifs, setSavingNotifs] = useState<boolean>(false);

  // My Reviews
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
      setRepairUpdatesNotif(customerProfile.notificationPreferences?.repairUpdates ?? true);
      setPaymentUpdatesNotif(customerProfile.notificationPreferences?.paymentUpdates ?? true);
      setPromotionalNotif(customerProfile.notificationPreferences?.promotional ?? false);
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

  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    try {
      await ApiClient.updateCustomerProfile({
        notificationPreferences: {
          repairUpdates: repairUpdatesNotif,
          paymentUpdates: paymentUpdatesNotif,
          promotional: promotionalNotif,
        },
      });
      if (refreshAuth) await refreshAuth();
      setShowNotifications(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update notification settings');
    } finally {
      setSavingNotifs(false);
    }
  };

  return (
    <div id="customer-profile-view" className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-extrabold text-2xl text-white shadow-md shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white truncate">{user?.name}</h2>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <p className="text-xs text-cyan-300 mt-0.5">{user?.phone}</p>
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

      {/* Borrowed Phone Notice */}
      {isBorrowedDevice && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
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

      {/* Quick Navigation Items */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {onOpenDevicesManager && (
          <button
            id="profile-my-devices-btn"
            onClick={onOpenDevicesManager}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">My Saved Devices</p>
                <p className="text-xs text-slate-500">Manage registered phones, colors, and storage</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <button
          onClick={onViewWarranties}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Digital Repair Passport & Warranties</p>
              <p className="text-xs text-slate-500">View active coverage and authentic parts log</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleOpenReviews}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">My Submitted Reviews</p>
              <p className="text-xs text-slate-500">View ratings and comments for completed repairs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={() => setShowNotifications(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Notification Preferences</p>
              <p className="text-xs text-slate-500">Configure repair, payment, and promotional alerts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={() => setShowHelp(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Help & Support Center</p>
              <p className="text-xs text-slate-500">Payment security rules, pickup codes & FAQs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Default Service Location</p>
              <p className="text-xs text-slate-500">
                {customerProfile?.defaultLocation?.address || 'Aba Road, Garrison'}, {customerProfile?.defaultLocation?.city || 'Port Harcourt'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-3.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Fixhub</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
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

      {/* Notification Preferences Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Notification Settings</h3>
                  <p className="text-xs text-slate-400">Control alerts and service notifications</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Repair Status Alerts</p>
                    <p className="text-[11px] text-slate-500">Quotes, drop-off, diagnosis & pickup readiness</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                    Transactional (Mandatory)
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Payment & Order Alerts</p>
                    <p className="text-[11px] text-slate-500">Payment confirmations & repair status updates</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                    Transactional (Mandatory)
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Promotional & Repeat Reminders</p>
                    <p className="text-[11px] text-slate-500">Seasonal discount offers & maintenance tips</p>
                  </div>
                  <button
                    onClick={() => setPromotionalNotif(!promotionalNotif)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      promotionalNotif ? 'bg-purple-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                        promotionalNotif ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifs}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {savingNotifs ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submitted Reviews Modal */}
      {showReviews && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">My Submitted Reviews</h3>
                  <p className="text-xs text-slate-400">Verified repair ratings & technician feedback</p>
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

      {/* Help & Support Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Fixhub Help & Support</h3>
                  <p className="text-xs text-slate-400">Everything you need to know about secure repairs</p>
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
