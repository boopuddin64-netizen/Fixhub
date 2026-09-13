import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import { FixhubLogo } from '../common/FixhubLogo';
import { OtpVerificationModal } from './OtpVerificationModal';
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Lock,
  MapPin,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UserCheck,
  Building2,
  HelpCircle,
  AlertTriangle,
  Layers,
  Clock,
  Zap,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

interface AuthAndOnboardingGatewayProps {
  onComplete: () => void;
  initialRole?: 'customer' | 'technician';
  onOpenIntro?: () => void;
}

export const AuthAndOnboardingGateway: React.FC<AuthAndOnboardingGatewayProps> = ({
  onComplete,
  initialRole = 'customer',
  onOpenIntro,
}) => {
  const { login, registerCustomer, registerTechnician, user, refreshUser, isLoading } = useAuth();

  // Primary Role Selection: 'customer' | 'technician'
  const [selectedRole, setSelectedRole] = useState<'customer' | 'technician'>(initialRole);

  // Authentication Mode: 'login' | 'register' | 'forgot_password'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');

  // Customer Registration State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custConfirmPassword, setCustConfirmPassword] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custLandmark, setCustLandmark] = useState('');
  const [custCity, setCustCity] = useState('Port Harcourt');
  const [custState, setCustState] = useState('Rivers State');
  const [custIsBorrowed, setCustIsBorrowed] = useState(false);

  // Technician Registration State
  const [techName, setTechName] = useState('');
  const [techBusinessName, setTechBusinessName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techPassword, setTechPassword] = useState('');
  const [techConfirmPassword, setTechConfirmPassword] = useState('');
  const [techShopAddress, setTechShopAddress] = useState('');
  const [techLandmark, setTechLandmark] = useState('');
  const [techArea, setTechArea] = useState('Garrison, Port Harcourt');
  const [techCity, setTechCity] = useState('Port Harcourt');
  const [techSupportedBrands, setTechSupportedBrands] = useState<string[]>([
    'Apple',
    'Samsung',
    'Google Pixel',
    'Xiaomi',
  ]);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginIsBorrowed, setLoginIsBorrowed] = useState(false);

  // Password Visibility Toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showCustPassword, setShowCustPassword] = useState(false);
  const [showCustConfirmPassword, setShowCustConfirmPassword] = useState(false);
  const [showTechPassword, setShowTechPassword] = useState(false);
  const [showTechConfirmPassword, setShowTechConfirmPassword] = useState(false);

  // Phone OTP Modal State (Blocking after Register/Login if unverified)
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [phoneToVerify, setPhoneToVerify] = useState('');

  // Forgot Password Flow State
  const [forgotEmailOrPhone, setForgotEmailOrPhone] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'otp' | 'new_password'>('request');
  const [forgotResetCode, setForgotResetCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);

  // Terms and Conditions State (NDPR Compliance)
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Switch role handler
  const handleRoleSwitch = (role: 'customer' | 'technician') => {
    setSelectedRole(role);
    setErrorMsg(null);
    setLoginIdentifier('');
  };

  const handlePreFillCustomerRegister = () => {
    setCustName('Tamuno Briggs');
    setCustPhone('+234 803 123 4567');
    setCustEmail(`tamuno.${Date.now().toString().slice(-4)}@fixhub.ng`);
    setCustPassword('Password123');
    setCustConfirmPassword('Password123');
    setCustAddress('Plot 14 Aba Road, Garrison');
    setCustLandmark('Near Garrison Junction');
    setCustCity('Port Harcourt');
    setCustState('Rivers State');
    setCustIsBorrowed(false);
    setTermsAccepted(true);
  };

  const handlePreFillTechnicianRegister = () => {
    setTechName('Baridura Nwiido');
    setTechBusinessName('Rivers Precision Microsoldering & Tech Hub');
    setTechPhone('+234 802 987 6543');
    setTechEmail(`baridura.${Date.now().toString().slice(-4)}@fixhub.ng`);
    setTechPassword('Password123');
    setTechConfirmPassword('Password123');
    setTechShopAddress('Shop 12, Garrison Tech Plaza, Aba Road');
    setTechLandmark('Near Garrison Junction');
    setTechArea('Garrison, Port Harcourt');
    setTechCity('Port Harcourt');
    setTechSupportedBrands(['Apple', 'Samsung', 'Google Pixel', 'Tecno', 'Infinix']);
    setTermsAccepted(true);
  };

  // Submission Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await login(loginIdentifier, loginPassword, loginIsBorrowed);
      // Refresh to get latest user session state
      await refreshUser();
      
      const currentUser = (window as any).__fixhub_user || user;
      if (currentUser && !currentUser.phoneVerified) {
        setPhoneToVerify(currentUser.phone || loginIdentifier);
        await ApiClient.requestPhoneVerification(currentUser.phone || loginIdentifier);
        setShowPhoneOtpModal(true);
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  const handleCustomerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!termsAccepted) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }
    if (custPassword.length < 8 || !/\d/.test(custPassword)) {
      setErrorMsg('Password must be at least 8 characters long and contain at least one number.');
      return;
    }
    if (custPassword !== custConfirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    try {
      await registerCustomer({
        name: custName,
        phone: custPhone,
        email: custEmail,
        password: custPassword,
        address: custAddress,
        landmark: custLandmark,
        city: custCity,
        state: custState,
        isBorrowedDevice: custIsBorrowed,
        termsAcceptedAt: new Date().toISOString(),
      } as any);

      setPhoneToVerify(custPhone);
      await ApiClient.requestPhoneVerification(custPhone);
      setShowPhoneOtpModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register customer.');
    }
  };

  const handleTechnicianRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!termsAccepted) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }
    if (techPassword.length < 8 || !/\d/.test(techPassword)) {
      setErrorMsg('Password must be at least 8 characters long and contain at least one number.');
      return;
    }
    if (techPassword !== techConfirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    try {
      await registerTechnician({
        name: techName,
        businessName: techBusinessName,
        phone: techPhone,
        email: techEmail,
        password: techPassword,
        shopAddress: techShopAddress,
        landmark: techLandmark,
        area: techArea,
        city: techCity,
        state: 'Rivers State',
        supportedBrands: techSupportedBrands,
        termsAcceptedAt: new Date().toISOString(),
      } as any);

      setPhoneToVerify(techPhone);
      await ApiClient.requestPhoneVerification(techPhone);
      setShowPhoneOtpModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register technician.');
    }
  };

  // OTP Verification for Phone
  const handleVerifyPhoneOtp = async (code: string) => {
    await ApiClient.confirmPhoneVerification(phoneToVerify, code);
    await refreshUser();
    setShowPhoneOtpModal(false);
    onComplete();
  };

  const handleResendPhoneOtp = async () => {
    await ApiClient.requestPhoneVerification(phoneToVerify);
  };

  // Forgot Password Handlers
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!forgotEmailOrPhone.trim()) {
      setErrorMsg('Please enter your email or phone number.');
      return;
    }

    try {
      await ApiClient.requestPasswordReset(forgotEmailOrPhone);
      setForgotStep('otp');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset code.');
    }
  };

  const handleForgotVerifyOtp = async (code: string) => {
    setForgotResetCode(code);
    setForgotStep('new_password');
  };

  const handleForgotResendOtp = async () => {
    await ApiClient.requestPasswordReset(forgotEmailOrPhone);
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (forgotNewPassword.length < 8 || !/\d/.test(forgotNewPassword)) {
      setErrorMsg('New password must be at least 8 characters long and contain at least one number.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    try {
      await ApiClient.resetPasswordWithCode(forgotResetCode, forgotNewPassword);
      setForgotSuccessMsg('Password reset successfully! You can now sign in with your new password.');
      setAuthMode('login');
      setLoginIdentifier(forgotEmailOrPhone);
      setLoginPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    }
  };

  return (
    <div
      id="auth-onboarding-gateway"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6"
    >
      {/* Brand Header */}
      <div className="w-full max-w-xl text-center space-y-3 mb-6 flex flex-col items-center">
        <FixhubLogo size="lg" theme="dark" variant="full" showTagline={false} />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Port Harcourt & Rivers State • Verified Repair Platform</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Connect with verified local phone technicians. Your payment is protected until you inspect and test your device at pickup.
        </p>

        {onOpenIntro && (
          <button
            type="button"
            id="auth-open-intro-guide-btn"
            onClick={onOpenIntro}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>How Fixhub Works (Intro Guide)</span>
          </button>
        )}
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* ================= 1. PRIMARY ROLE SWITCH (Customer vs Technician) ================= */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
            Step 1: Select Portal Role
          </label>
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              id="role-switch-customer-btn"
              type="button"
              onClick={() => handleRoleSwitch('customer')}
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedRole === 'customer'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">Customer Portal</span>
                <span className="text-[10px] opacity-80 font-normal">Need Phone Repaired</span>
              </div>
            </button>

            <button
              id="role-switch-technician-btn"
              type="button"
              onClick={() => handleRoleSwitch('technician')}
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedRole === 'technician'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">Technician Store</span>
                <span className="text-[10px] opacity-80 font-normal">Repair Pro / Workshop</span>
              </div>
            </button>
          </div>
        </div>

        {/* ================= 2. MODE SWITCH (Sign In vs Register) ================= */}
        <div className="flex items-center justify-center border-b border-slate-800 pb-2">
          <div className="flex items-center gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMsg(null);
              }}
              className={`pb-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                authMode === 'login'
                  ? selectedRole === 'customer'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMsg(null);
              }}
              className={`pb-2 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                authMode === 'register'
                  ? selectedRole === 'customer'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Success / Info Notification */}
        {forgotSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{forgotSuccessMsg}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ======================= VIEW A: LOGIN FORM ======================= */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs animate-in fade-in duration-150">
            <div>
              <h3 className="font-extrabold text-sm text-white">
                {selectedRole === 'customer' ? 'Customer Sign In' : 'Technician Workshop Sign In'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedRole === 'customer'
                  ? 'Log in to track repairs, approve quotes & view warranty passports'
                  : 'Log in to manage your workshop workbench & payouts'}
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">
                {selectedRole === 'customer' ? 'Email Address or Phone' : 'Store Email or Phone'}
              </label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder={
                  selectedRole === 'customer'
                    ? 'you@example.com or +234...'
                    : 'yourshop@example.com or +234...'
                }
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot_password');
                    setForgotStep('request');
                    setErrorMsg(null);
                    setForgotSuccessMsg(null);
                  }}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {selectedRole === 'customer' && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loginIsBorrowed}
                    onChange={(e) => setLoginIsBorrowed(e.target.checked)}
                    className="rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs">
                    Borrowed Device Protection (temporary emergency session with quick wipe)
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                selectedRole === 'customer'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              <span>{isLoading ? 'Authenticating...' : `Sign In as ${selectedRole === 'customer' ? 'Customer' : 'Technician'}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
              >
                Don't have an account yet? Register here →
              </button>
            </div>
          </form>
        )}

        {/* ======================= VIEW B: FORGOT PASSWORD FORM ======================= */}
        {authMode === 'forgot_password' && (
          <div className="space-y-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm text-white">Reset Password</h3>
                <p className="text-[11px] text-slate-400">
                  {forgotStep === 'request'
                    ? 'Enter your registered phone or email address'
                    : forgotStep === 'otp'
                    ? 'Enter the 6-digit verification code sent to your phone/email'
                    : 'Set your new secure password'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-white font-semibold underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>

            {forgotStep === 'request' && (
              <form onSubmit={handleForgotRequestSubmit} className="space-y-4">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Registered Phone or Email</label>
                  <input
                    type="text"
                    value={forgotEmailOrPhone}
                    onChange={(e) => setForgotEmailOrPhone(e.target.value)}
                    required
                    placeholder="+234... or email@example.com"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Send Reset Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <OtpVerificationModal
                title="Password Reset Verification"
                subtitle="Enter the 6-digit code sent to your phone/email to reset your password."
                targetAddress={forgotEmailOrPhone}
                type="password_reset"
                onVerify={handleForgotVerifyOtp}
                onResend={handleForgotResendOtp}
                onClose={() => setForgotStep('request')}
                isBlocking={false}
              />
            )}

            {forgotStep === 'new_password' && (
              <form onSubmit={handleForgotResetSubmit} className="space-y-4">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">New Password (8+ chars, 1 digit)</label>
                  <div className="relative">
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Update Password & Sign In</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* ======================= VIEW B: CUSTOMER REGISTER FORM ======================= */}
        {authMode === 'register' && selectedRole === 'customer' && (
          <form onSubmit={handleCustomerRegisterSubmit} className="space-y-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm text-white">Create Customer Account</h3>
                <p className="text-[11px] text-slate-400">Join the trusted repair network</p>
              </div>

              <button
                type="button"
                onClick={handlePreFillCustomerRegister}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Fill Sample</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  placeholder="Tunde Adebayo"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Phone Number (WhatsApp/SMS)</label>
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                  placeholder="+234 803 123 4567"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tunde@fixhub.ng"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Password (8+ chars, 1 digit)</label>
                <div className="relative">
                  <input
                    type={showCustPassword ? 'text' : 'password'}
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustPassword(!showCustPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showCustPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showCustConfirmPassword ? 'text' : 'password'}
                    value={custConfirmPassword}
                    onChange={(e) => setCustConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustConfirmPassword(!showCustConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showCustConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Your Location Address (e.g. Aba Road, Port Harcourt)</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  required
                  placeholder="e.g. Plot 14 Aba Road, Garrison"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Landmark</label>
                <input
                  type="text"
                  value={custLandmark}
                  onChange={(e) => setCustLandmark(e.target.value)}
                  placeholder="Beside Ikeja City Mall"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">City / State</label>
                <input
                  type="text"
                  value={`${custCity}, ${custState}`}
                  readOnly
                  className="w-full p-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={custIsBorrowed}
                  onChange={(e) => setCustIsBorrowed(e.target.checked)}
                  className="rounded text-blue-600 bg-slate-900 border-slate-700"
                />
                <span className="text-xs">
                  I am currently using a borrowed/friend's phone to request this repair
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-slate-700/80">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  className="mt-0.5 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I agree to Fixhub's{' '}
                  <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-400 font-bold underline hover:text-blue-300">Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-blue-400 font-bold underline hover:text-blue-300">Privacy Policy</button>
                  {' '}(NDPR compliant data processing).
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? 'Creating Account...' : 'Register Account & Request Repair'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
              >
                Already have an account? Sign in here →
              </button>
            </div>
          </form>
        )}

        {/* ======================= VIEW C: TECHNICIAN REGISTER FORM ======================= */}
        {authMode === 'register' && selectedRole === 'technician' && (
          <form onSubmit={handleTechnicianRegisterSubmit} className="space-y-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm text-white">Register Repair Workshop / Store</h3>
                <p className="text-[11px] text-slate-400">Join verified technicians in Computer Village & Lagos</p>
              </div>

              <button
                type="button"
                onClick={handlePreFillTechnicianRegister}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Fill Sample</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Master Tech Full Name</label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  required
                  placeholder="Emeka Okafor"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Workshop / Business Name</label>
                <input
                  type="text"
                  value={techBusinessName}
                  onChange={(e) => setTechBusinessName(e.target.value)}
                  required
                  placeholder="Okafor Express Fix & Parts"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Store Phone Number</label>
                <input
                  type="tel"
                  value={techPhone}
                  onChange={(e) => setTechPhone(e.target.value)}
                  required
                  placeholder="+234 802 987 6543"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Store Email</label>
                <input
                  type="email"
                  value={techEmail}
                  onChange={(e) => setTechEmail(e.target.value)}
                  required
                  placeholder="emeka.tech@fixhub.ng"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Physical Workshop Address (Computer Village / Lagos)</label>
              <input
                type="text"
                value={techShopAddress}
                onChange={(e) => setTechShopAddress(e.target.value)}
                required
                placeholder="Shop 14, Digital Bridge Plaza, Computer Village, Ikeja"
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Market Zone / Area</label>
                <input
                  type="text"
                  value={techArea}
                  onChange={(e) => setTechArea(e.target.value)}
                  placeholder="Computer Village, Ikeja"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Password (8+ chars, 1 digit)</label>
                <div className="relative">
                  <input
                    type={showTechPassword ? 'text' : 'password'}
                    value={techPassword}
                    onChange={(e) => setTechPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTechPassword(!showTechPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showTechPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showTechConfirmPassword ? 'text' : 'password'}
                    value={techConfirmPassword}
                    onChange={(e) => setTechConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTechConfirmPassword(!showTechConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showTechConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
              <span className="font-bold text-slate-300 text-xs block">Supported Brands</span>
              <div className="flex flex-wrap gap-2">
                {['Apple', 'Samsung', 'Google Pixel', 'Xiaomi', 'Tecno', 'Infinix'].map((brand) => (
                  <button
                    type="button"
                    key={brand}
                    onClick={() => {
                      if (techSupportedBrands.includes(brand)) {
                        setTechSupportedBrands(techSupportedBrands.filter((b) => b !== brand));
                      } else {
                        setTechSupportedBrands([...techSupportedBrands, brand]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      techSupportedBrands.includes(brand)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {techSupportedBrands.includes(brand) ? '✓ ' : '+ '}
                    {brand}
                  </button>
                ))}
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-3 border-t border-slate-700">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  className="mt-0.5 rounded text-indigo-600 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I agree to Fixhub Partner Workshop{' '}
                  <button type="button" onClick={() => setShowTermsModal(true)} className="text-indigo-400 font-bold underline hover:text-indigo-300">Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-indigo-400 font-bold underline hover:text-indigo-300">Privacy Policy</button>
                  {' '}(NDPR compliant).
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? 'Registering Store...' : 'Register Workshop & Configure Store Wizard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
              >
                Already have a technician account? Sign in here →
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Trust Badges Footer */}
      <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-4 flex-wrap">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Paystack Buyer Guarantee
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          Verified Nigerian Workshops
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          Protected Direct Settlement
        </span>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white">Fixhub Terms of Service</h3>
              <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="text-xs space-y-3 leading-relaxed text-slate-300">
              <p><strong>1. Service Overview:</strong> Fixhub provides a platform connecting device owners with verified repair technicians in Port Harcourt and across Nigeria.</p>
              <p><strong>2. Payment & Holds:</strong> Customer payments are processed securely through Paystack. Funds are safely held until the customer approves the repair after testing at pickup or drop-off.</p>
              <p><strong>3. Warranty Passports:</strong> All completed repairs performed by verified Fixhub technicians include a digital warranty passport with an explicit warranty duration period.</p>
              <p><strong>4. Disputes:</strong> In the event of a repair quality dispute, Fixhub mediation holds funds while inspecting the device status.</p>
            </div>
            <button
              onClick={() => {
                setTermsAccepted(true);
                setShowTermsModal(false);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              I Accept Terms of Service
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white">Fixhub Privacy Policy (NDPR)</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="text-xs space-y-3 leading-relaxed text-slate-300">
              <p><strong>1. Data Compliance:</strong> Compliant with the Nigeria Data Protection Regulation (NDPR) and Nigeria Data Protection Act 2023.</p>
              <p><strong>2. Personal Data Collected:</strong> We collect name, phone number, email address, physical location address, and device repair specs required to fulfill repair requests.</p>
              <p><strong>3. Usage & Sharing:</strong> Your data is shared only with the assigned repair technician for device pickup/diagnostic purposes and Paystack for payment processing.</p>
              <p><strong>4. User Rights:</strong> You have full rights to request account data export, data correction, or account deletion at any time via your account settings.</p>
            </div>
            <button
              onClick={() => {
                setTermsAccepted(true);
                setShowPrivacyModal(false);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              I Accept Privacy Policy
            </button>
          </div>
        </div>
      )}

      {/* Blocking Phone OTP Modal */}
      {showPhoneOtpModal && (
        <OtpVerificationModal
          title="Verify Your Phone Number"
          subtitle="Enter the 6-digit verification code sent to your mobile phone."
          targetAddress={phoneToVerify}
          type="phone"
          onVerify={handleVerifyPhoneOtp}
          onResend={handleResendPhoneOtp}
          isBlocking={true}
        />
      )}
    </div>
  );
};
