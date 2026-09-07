import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FixhubLogo } from '../common/FixhubLogo';
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
  UserPlus
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
  const { login, registerCustomer, registerTechnician, isLoading } = useAuth();

  // Primary Role Selection: 'customer' | 'technician'
  const [selectedRole, setSelectedRole] = useState<'customer' | 'technician'>(initialRole);

  // Authentication Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Customer Registration State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('password123');
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
  const [techPassword, setTechPassword] = useState('password123');
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
  const [loginIdentifier, setLoginIdentifier] = useState('customer@test.fixhub.local');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginIsBorrowed, setLoginIsBorrowed] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Switch role handler
  const handleRoleSwitch = (role: 'customer' | 'technician') => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (role === 'customer') {
      setLoginIdentifier('customer@test.fixhub.local');
    } else {
      setLoginIdentifier('technician@test.fixhub.local');
    }
  };

  // Sample Autofill Helpers for Forms
  const handleFillSampleCustomerLogin = () => {
    setLoginIdentifier('customer@test.fixhub.local');
    setLoginPassword('password123');
    setLoginIsBorrowed(false);
  };

  const handleFillSampleTechnicianLogin = () => {
    setLoginIdentifier('technician@test.fixhub.local');
    setLoginPassword('password123');
    setLoginIsBorrowed(false);
  };

  const handlePreFillCustomerRegister = () => {
    setCustName('Tamuno Briggs');
    setCustPhone('+234 803 123 4567');
    setCustEmail(`tamuno.${Date.now().toString().slice(-4)}@fixhub.ng`);
    setCustPassword('password123');
    setCustAddress('Plot 14 Aba Road, Garrison');
    setCustLandmark('Near Garrison Junction');
    setCustCity('Port Harcourt');
    setCustState('Rivers State');
    setCustIsBorrowed(false);
  };

  const handlePreFillTechnicianRegister = () => {
    setTechName('Baridura Nwiido');
    setTechBusinessName('Rivers Precision Microsoldering & Tech Hub');
    setTechPhone('+234 802 987 6543');
    setTechEmail(`baridura.${Date.now().toString().slice(-4)}@fixhub.ng`);
    setTechPassword('password123');
    setTechShopAddress('Shop 12, Garrison Tech Plaza, Aba Road');
    setTechLandmark('Near Garrison Junction');
    setTechArea('Garrison, Port Harcourt');
    setTechCity('Port Harcourt');
    setTechSupportedBrands(['Apple', 'Samsung', 'Google Pixel', 'Tecno', 'Infinix']);
  };

  // Submission Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await login(loginIdentifier, loginPassword, loginIsBorrowed);
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  const handleCustomerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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
      });
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register customer.');
    }
  };

  const handleTechnicianRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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
      });
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register technician.');
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
          <span>Port Harcourt & Rivers State • 100% Escrow Protection</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Connect with verified local phone technicians. Your money is protected in escrow until you inspect and test your device.
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">
                  {selectedRole === 'customer' ? 'Customer Sign In' : 'Technician Workshop Sign In'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {selectedRole === 'customer'
                    ? 'Log in to track repairs, approve quotes & view escrow warranty passports'
                    : 'Log in to manage your Computer Village workshop workbench & payouts'}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  selectedRole === 'customer'
                    ? handleFillSampleCustomerLogin
                    : handleFillSampleTechnicianLogin
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Autofill default test credentials"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Fill Credentials</span>
              </button>
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
                placeholder={
                  selectedRole === 'customer'
                    ? 'customer@test.fixhub.local'
                    : 'technician@test.fixhub.local'
                }
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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

        {/* ======================= VIEW B: CUSTOMER REGISTER FORM ======================= */}
        {authMode === 'register' && selectedRole === 'customer' && (
          <form onSubmit={handleCustomerRegisterSubmit} className="space-y-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm text-white">Create Customer Account</h3>
                <p className="text-[11px] text-slate-400">Join the safe escrow repair network</p>
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
                  placeholder="tunde@fixhub.ng"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Password</label>
                <input
                  type="password"
                  value={custPassword}
                  onChange={(e) => setCustPassword(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300">
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
                <label className="font-bold text-slate-300 block mb-1">Password</label>
                <input
                  type="password"
                  value={techPassword}
                  onChange={(e) => setTechPassword(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5">
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
          Escrow Buyer Guarantee
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          Verified Nigerian Workshops
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          Bank Escrow Settlement
        </span>
      </div>
    </div>
  );
};
