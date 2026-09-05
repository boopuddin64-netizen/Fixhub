import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  Building2,
  Clock,
  Wrench,
  Package,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
  MapPin,
  Check
} from 'lucide-react';

interface TechnicianStoreSetupViewProps {
  onSetupCompleted: () => void;
}

export const TechnicianStoreSetupView: React.FC<TechnicianStoreSetupViewProps> = ({ onSetupCompleted }) => {
  const { user, technicianProfile, refreshUser } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Store & Operating Hours
  const [businessName, setBusinessName] = useState(technicianProfile?.businessName || 'Okafor Express Fix & Parts');
  const [bio, setBio] = useState(
    technicianProfile?.bio ||
      'Certified master technician in Computer Village Ikeja. Specializing in precision Apple iPhone screen replacement, Samsung OLEDs, and logic board soldering.'
  );
  const [businessHours, setBusinessHours] = useState(technicianProfile?.businessHours || 'Mon - Sat: 8:30 AM - 6:30 PM');
  const [shopAddress, setShopAddress] = useState(
    technicianProfile?.shopLocation?.address || 'Shop 14, Digital Bridge Plaza, Computer Village, Ikeja'
  );
  const [area, setArea] = useState(technicianProfile?.shopLocation?.area || 'Computer Village, Ikeja');

  // Step 2: Bank Settlement Details
  const [bankName, setBankName] = useState(technicianProfile?.bankDetails?.bankName || 'Access Bank');
  const [accountNumber, setAccountNumber] = useState(technicianProfile?.bankDetails?.accountNumber || '0129849201');
  const [accountName, setAccountName] = useState(technicianProfile?.bankDetails?.accountName || businessName || 'Emeka Okafor Enterprises');

  // Step 3: Parts Inventory Setup
  const [parts, setParts] = useState<any[]>([]);
  const [newPartName, setNewPartName] = useState('iPhone 13 OLED Display Panel (Hard OLED)');
  const [newPartBrand, setNewPartBrand] = useState('Apple');
  const [newPartModel, setNewPartModel] = useState('iPhone 13');
  const [newPartQuality, setNewPartQuality] = useState('PREMIUM_AFTERMARKET');
  const [newPartPrice, setNewPartPrice] = useState(48000);
  const [newPartStock, setNewPartStock] = useState(6);
  const [newPartWarranty, setNewPartWarranty] = useState(90);

  useEffect(() => {
    if (user?.id) {
      ApiClient.getTechnicianParts(user.id)
        .then((p) => setParts(p || []))
        .catch(() => {});
    }
  }, [user]);

  const handleSaveStoreProfile = async () => {
    setIsSaving(true);
    try {
      await ApiClient.updateTechnicianProfile({
        businessName,
        bio,
        businessHours,
        shopLocation: {
          address: shopAddress,
          area,
          city: 'Lagos',
          state: 'Lagos State',
          lat: 6.5355,
          lng: 3.3644,
        },
      });
      await ApiClient.setTechnicianAvailability('AVAILABLE');
      await refreshUser();
      setStep(2);
    } catch (err) {
      console.error('Failed to update store profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBankDetails = async () => {
    setIsSaving(true);
    try {
      await ApiClient.updateTechnicianProfile({
        bankDetails: {
          bankName,
          accountNumber,
          accountName,
        },
      });
      await refreshUser();
      setStep(3);
    } catch (err) {
      console.error('Failed to save bank details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const added = await ApiClient.addTechnicianPart({
        name: newPartName,
        deviceBrand: newPartBrand,
        deviceModel: newPartModel,
        quality: newPartQuality,
        priceNaira: newPartPrice,
        inStockCount: newPartStock,
        warrantyDays: newPartWarranty,
      });
      setParts((prev) => [...prev, added]);
      setNewPartName('Samsung Galaxy S22 Ultra Battery (Original OEM)');
      setNewPartBrand('Samsung');
      setNewPartModel('Galaxy S22 Ultra');
      setNewPartQuality('ORIGINAL_OEM');
      setNewPartPrice(28000);
      setNewPartStock(8);
      setNewPartWarranty(90);
    } catch (err) {
      console.error('Failed to add part:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedPresetParts = async () => {
    setIsSaving(true);
    try {
      const presetParts = [
        {
          name: 'iPhone 13 OLED Screen Replacement (Premium Hard OLED)',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 13',
          quality: 'PREMIUM_AFTERMARKET',
          priceNaira: 48000,
          inStockCount: 10,
          warrantyDays: 90,
        },
        {
          name: 'iPhone 12 / 12 Pro Battery Pack OEM Grade',
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 12',
          quality: 'ORIGINAL_OEM',
          priceNaira: 24000,
          inStockCount: 12,
          warrantyDays: 90,
        },
        {
          name: 'Samsung Galaxy S22 Dynamic AMOLED 2X Display Module',
          deviceBrand: 'Samsung',
          deviceModel: 'Galaxy S22',
          quality: 'ORIGINAL_OEM',
          priceNaira: 85000,
          inStockCount: 4,
          warrantyDays: 90,
        },
      ];

      for (const p of presetParts) {
        const added = await ApiClient.addTechnicianPart(p);
        setParts((prev) => [...prev, added]);
      }
    } catch (err) {
      console.error('Failed to seed preset parts:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishSetup = async () => {
    await ApiClient.setTechnicianAvailability('AVAILABLE');
    await refreshUser();
    onSetupCompleted();
  };

  return (
    <div id="technician-store-setup-container" className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-3xl border border-indigo-800/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Technician Store Onboarding Wizard</span>
          </div>

          <button
            onClick={onSetupCompleted}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Skip to Workbench →
          </button>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white">
          Configure Your Fix Hub Workshop & Parts Catalog
        </h1>
        <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
          Set up your operating hours in Computer Village, verify your bank account for escrow payouts, and list your stock to start receiving nearby repair requests.
        </p>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 pt-3">
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              step === 1
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : step > 1
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center shrink-0">
              {step > 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : '1'}
            </div>
            <span className="truncate">1. Store Profile & Hours</span>
          </div>

          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              step === 2
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : step > 2
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center shrink-0">
              {step > 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : '2'}
            </div>
            <span className="truncate">2. Payout Bank Account</span>
          </div>

          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              step === 3
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center shrink-0">3</div>
            <span className="truncate">3. Parts Inventory</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: STORE PROFILE & HOURS ================= */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Workshop Identity & Operating Schedule</h2>
              <p className="text-xs text-slate-400">Establish your verified storefront in Computer Village</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Business / Storefront Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Mon - Sat: 8:30 AM - 6:30 PM"
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Physical Workshop Address</label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                placeholder="Shop 14, Digital Bridge Plaza, Computer Village, Ikeja"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Workshop Bio & Specialties</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
              <div className="text-xs">
                <span className="font-bold block">Live Status: AVAILABLE</span>
                <span className="text-emerald-200/80 text-[11px]">
                  Your workshop will be immediately discoverable to customers requesting repairs within a 15km radius.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveStoreProfile}
                disabled={isSaving}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <span>{isSaving ? 'Saving...' : 'Save & Continue to Bank Setup'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 2: BANK SETTLEMENT SETUP ================= */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Escrow Settlement Bank Account</h2>
              <p className="text-xs text-slate-400">Where you receive automatic payouts upon customer pickup verification</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-blue-300">
                <ShieldCheck className="w-4 h-4" />
                Guaranteed Escrow Payout Protocol:
              </span>
              <p className="text-[11px] text-blue-200/80">
                When a customer enters the 6-digit pickup verification code (`PK-XXXX`), escrow funds (Net of 8.5% platform escrow fee) settle directly into your bank account within minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Bank Name</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Access Bank">Access Bank</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="Guaranty Trust Bank (GTBank)">Guaranty Trust Bank (GTBank)</option>
                  <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                  <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                  <option value="Providus Bank">Providus Bank</option>
                  <option value="Kuda Microfinance Bank">Kuda Microfinance Bank</option>
                  <option value="OPay">OPay</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">10-Digit NUBAN Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0129849201"
                  maxLength={10}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Verified Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Emeka Okafor Enterprises"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                ← Back
              </button>

              <button
                onClick={handleSaveBankDetails}
                disabled={isSaving}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <span>{isSaving ? 'Verifying Account...' : 'Confirm Bank & Setup Parts'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 3: PARTS CATALOG INVENTORY ================= */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Stock & Parts Catalog</h2>
                <p className="text-xs text-slate-400">List replacement screens, batteries, and charging ports with transparent warranties</p>
              </div>
            </div>

            <button
              onClick={handleSeedPresetParts}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>+ Add Popular Lagos Inventory</span>
            </button>
          </div>

          {/* Current Listed Parts */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Inventory ({parts.length} parts listed)
            </h3>

            {parts.length === 0 ? (
              <div className="p-6 text-center bg-slate-800/40 rounded-2xl border border-slate-800 space-y-2">
                <Package className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400">No parts in your catalog yet. Add one below or click "Add Popular Lagos Inventory".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {parts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-extrabold text-white">
                        <span className="truncate pr-2">{p.name}</span>
                        <span className="text-emerald-400 font-mono shrink-0">₦{Number(p.priceNaira).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {p.deviceBrand} {p.deviceModel} • {p.quality?.replace(/_/g, ' ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700/60 pt-1.5">
                      <span className="text-blue-400 font-bold">{p.warrantyDays} Days Warranty</span>
                      <span className="text-slate-300">Stock: {p.inStockCount} units</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Custom Part Form */}
          <form onSubmit={handleAddPart} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3 text-xs">
            <span className="font-bold text-slate-300 block">Add Custom Part to Store Inventory</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Part Description</label>
                <input
                  type="text"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  required
                  placeholder="e.g. iPhone 13 OLED Display"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Device Model</label>
                <input
                  type="text"
                  value={newPartModel}
                  onChange={(e) => setNewPartModel(e.target.value)}
                  placeholder="iPhone 13 / Samsung S22"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Price (₦)</label>
                <input
                  type="number"
                  value={newPartPrice}
                  onChange={(e) => setNewPartPrice(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quality Tier</label>
                <select
                  value={newPartQuality}
                  onChange={(e) => setNewPartQuality(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                >
                  <option value="ORIGINAL_OEM">Original OEM</option>
                  <option value="PREMIUM_AFTERMARKET">Premium Hard OLED</option>
                  <option value="STANDARD_AFTERMARKET">Standard Aftermarket</option>
                  <option value="REFURBISHED">Refurbished</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Warranty (Days)</label>
                <input
                  type="number"
                  value={newPartWarranty}
                  onChange={(e) => setNewPartWarranty(Number(e.target.value))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Part to Store</span>
            </button>
          </form>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              ← Back
            </button>

            <button
              onClick={handleFinishSetup}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Finish Setup & Open Live Workbench</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
