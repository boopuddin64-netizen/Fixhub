import React, { useState, useEffect, useCallback } from 'react';
import { RepairJob, RepairRequest, TechnicianProfile, DeviceBrand, CustomerDevice, DeviceType, RepairIssueOption } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  Smartphone,
  Tablet,
  ChevronRight,
  Lock,
  Layers,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BatteryCharging,
  Droplets,
  Camera,
  Volume2
} from 'lucide-react';

interface CustomerHomeViewProps {
  onStartRepair: (options?: {
    device?: CustomerDevice;
    brand?: string;
    model?: string;
    issue?: string;
  }) => void;
  onOpenRepair: (jobId: string) => void;
  onOpenQuotes?: (requestId: string) => void;
  onViewWarranties: () => void;
  onOpenDevicesManager: () => void;
}

export const CustomerHomeView: React.FC<CustomerHomeViewProps> = ({
  onStartRepair,
  onOpenRepair,
  onOpenQuotes,
  onViewWarranties,
  onOpenDevicesManager,
}) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<RepairJob[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RepairRequest[]>([]);
  const [savedDevices, setSavedDevices] = useState<CustomerDevice[]>([]);
  const [topTechs, setTopTechs] = useState<TechnicianProfile[]>([]);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [issuesList, setIssuesList] = useState<RepairIssueOption[]>([]);
  const [deviceType, setDeviceType] = useState<DeviceType>('PHONE');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Home Quick Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{ brands: DeviceBrand[]; models: any[] }>({
    brands: [],
    models: [],
  });
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [jobs, reqs, devs, techs, brandList, issues] = await Promise.all([
        ApiClient.getJobs().catch(() => []),
        ApiClient.getRepairRequests().catch(() => []),
        ApiClient.getCustomerDevices().catch(() => []),
        ApiClient.getTechnicians().catch(() => []),
        ApiClient.getBrands().catch(() => []),
        ApiClient.getIssues().catch(() => []),
      ]);

      const safeJobs = Array.isArray(jobs) ? jobs : [];
      const safeReqs = Array.isArray(reqs) ? reqs : [];
      const safeDevs = Array.isArray(devs) ? devs : [];
      const safeTechs = Array.isArray(techs) ? techs : [];
      const safeBrands = Array.isArray(brandList) ? brandList : [];
      const safeIssues = Array.isArray(issues) ? issues : [];

      setActiveJobs(safeJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED'));
      setPendingRequests(
        safeReqs.filter(
          (r) =>
            r.status === 'REQUESTED' ||
            r.status === 'QUOTING' ||
            r.status === 'SUBMITTED' ||
            r.status === 'MATCHING'
        )
      );
      setSavedDevices(safeDevs);
      setTopTechs(safeTechs.slice(0, 3));
      setBrands(safeBrands);
      setIssuesList(safeIssues);
    } catch (err) {
      console.error('CustomerHomeView load error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Search Input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ brands: [], models: [] });
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      ApiClient.searchDevices(searchQuery.trim(), deviceType)
        .then((res) => setSearchResults(res))
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, deviceType]);

  const primaryDevice = savedDevices.find((d) => d.isPrimary) || savedDevices[0];

  const commonIssueShortcuts = [
    {
      id: 'screen_damaged',
      label: 'Cracked Screen',
      icon: Smartphone,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    {
      id: 'battery_drain',
      label: 'Battery Replacement',
      icon: BatteryCharging,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      id: 'charging_port',
      label: 'Charging Port Faulty',
      icon: Zap,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      id: 'water_damage',
      label: 'Water Damage Cleanup',
      icon: Droplets,
      color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    },
    {
      id: 'camera_glass',
      label: 'Camera Lens Broken',
      icon: Camera,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
      id: 'speaker_low',
      label: 'Speaker / Mic Muffled',
      icon: Volume2,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
  ];

  return (
    <div id="customer-home-view" className="space-y-6 pb-12">
      {/* Top Greeting & Pull/Tap Refresh Bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Hi, {user?.name?.split(' ')[0] || 'Friend'} 👋
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Get reliable, escrow-protected device repairs in Port Harcourt & Rivers State
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer shadow-xs"
          title="Refresh repairs & quotes"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Hero CTA & Instant Device Search */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-800">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-cyan-300 text-xs font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Computer Village & Nationwide Certified Techs</span>
          </div>

          <div className="max-w-xl space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              Fix your phone with verified parts and 100% escrow protection.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              No hidden fees. Get fair quotes from top vetted shops, pay into escrow, and release funds only after you test the fix.
            </p>
          </div>

          {/* Instant Search Box on Home */}
          <div className="relative max-w-lg pt-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type device (e.g. iPhone 13, Galaxy A15, Camon 30)..."
                className="w-full pl-10 pr-10 py-3 bg-slate-900/90 text-white placeholder-slate-400 text-xs sm:text-sm rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 max-h-72 overflow-y-auto divide-y divide-slate-100">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Searching catalog...</span>
                  </div>
                ) : searchResults.models.length === 0 && searchResults.brands.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500">No exact catalog match for "{searchQuery}"</p>
                    <button
                      onClick={() => {
                        onStartRepair({ model: searchQuery.trim() });
                        setSearchQuery('');
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Start repair request with this model</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {searchResults.models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onStartRepair({
                            brand: model.brandName,
                            model: model.name,
                          });
                          setSearchQuery('');
                        }}
                        className="w-full p-3 hover:bg-blue-50/60 transition-colors flex items-center justify-between text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {model.brandName} {model.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {model.familyName || model.deviceType} • Released {model.releaseYear}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-blue-600 font-bold shrink-0">Book Repair →</span>
                      </button>
                    ))}

                    {searchResults.brands.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() => {
                          onStartRepair({ brand: brand.name });
                          setSearchQuery('');
                        }}
                        className="w-full p-3 hover:bg-blue-50/60 transition-colors flex items-center justify-between text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                            {brand.name.charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-slate-800">{brand.name} (Browse all models)</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              id="hero-repair-my-phone-btn"
              onClick={() => onStartRepair()}
              className="group flex items-center gap-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm sm:text-base px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="block text-sm sm:text-base font-black leading-tight">Repair my device</span>
                <span className="block text-[11px] text-emerald-100 font-medium">Tell us what&apos;s wrong →</span>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform ml-2 shrink-0" />
            </button>

            <button
              onClick={onOpenDevicesManager}
              className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4 text-cyan-300" />
              <span>My Saved Devices ({savedDevices.length})</span>
            </button>
          </div>
        </div>

        {/* Ambient Blur Graphics */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-12 top-4 w-40 h-40 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Active Repairs / Pending Quotes Banner */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Active Repair Job</span>
            </h3>
            <span className="text-xs font-bold text-blue-600">Live Status</span>
          </div>

          {activeJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onOpenRepair(job.id)}
              className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-blue-500/40 hover:border-blue-600 transition-all shadow-md cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm sm:text-base text-slate-900">
                      {job.deviceBrand} {job.deviceModel}
                    </h4>
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Issues: <span className="font-semibold text-slate-700">{(job.issues || []).join(', ')}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Secured Escrow: <span className="font-bold text-emerald-700">₦{job.finalAmount.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <span className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  Track Live <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Quotes Waiting for Review */}
      {pendingRequests.length > 0 && activeJobs.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Quotes Ready for Comparison</span>
            </h3>
            <span className="text-xs font-bold text-amber-600">Action Needed</span>
          </div>

          {pendingRequests.map((req) => (
            <div
              key={req.id}
              onClick={() => onOpenQuotes ? onOpenQuotes(req.id) : onStartRepair()}
              className="bg-amber-50/60 p-4 rounded-2xl border border-amber-300/80 hover:border-amber-400 transition-all shadow-xs cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {req.quotesCount || 1}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {req.deviceBrand} {req.deviceModel} ({(req.issues || []).join(', ')})
                  </h4>
                  <p className="text-[11px] text-amber-900 font-medium">
                    {req.quotesCount || 1} technician quote(s) received • Tap to compare
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-800 shrink-0">Compare →</span>
            </div>
          ))}
        </div>
      )}

      {/* Customer "My Devices" Quick Showcase */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">My Saved Devices</h3>
          </div>
          <button
            onClick={onOpenDevicesManager}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            {savedDevices.length > 0 ? `Manage All (${savedDevices.length})` : '+ Add Device'}
          </button>
        </div>

        {primaryDevice ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                {primaryDevice.deviceType === 'TABLET' ? (
                  <Tablet className="w-5 h-5" />
                ) : (
                  <Smartphone className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900">
                    {primaryDevice.brandName} {primaryDevice.modelName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-600 text-white font-bold">
                    Primary
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {primaryDevice.nickname && `"${primaryDevice.nickname}" • `}
                  {primaryDevice.color || 'Standard'} • {primaryDevice.storage || '128GB'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => onStartRepair({ device: primaryDevice })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Fix This Phone</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600 font-medium">
              Save your primary phone or tablet for fast 1-tap repairs next time.
            </p>
            <button
              onClick={onOpenDevicesManager}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register My Device</span>
            </button>
          </div>
        )}
      </div>

      {/* Common Repair Issues (1-Tap Shortcut) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">What Needs Fixing?</h3>
          <span className="text-xs text-slate-500">Direct 1-Tap Booking</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {commonIssueShortcuts.map((iss) => {
            const Icon = iss.icon;
            return (
              <button
                key={iss.id}
                onClick={() => onStartRepair({ issue: iss.id })}
                className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${iss.color} transition-transform group-hover:scale-105`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug truncate">{iss.label}</p>
                  <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">
                    Get Quote →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Device Catalog - Browse by Brand */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Browse Supported Brands</h3>
          {/* Device Type Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setDeviceType('PHONE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                deviceType === 'PHONE' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Phones
            </button>
            <button
              onClick={() => setDeviceType('TABLET')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                deviceType === 'TABLET' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Tablets
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {brands
            .filter((b) => !b.deviceTypes || b.deviceTypes.includes(deviceType))
            .slice(0, 8)
            .map((b) => (
              <button
                key={b.id}
                onClick={() => onStartRepair({ brand: b.name })}
                className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer shadow-xs group"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center text-slate-700 transition-colors">
                  {deviceType === 'TABLET' ? (
                    <Tablet className="w-4 h-4" />
                  ) : (
                    <Smartphone className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-900 truncate w-full">{b.name}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Fix Hub Trust Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">Escrow Protection Guarantee</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Your money stays in escrow. We release payment only AFTER you inspect your device.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">60 to 90 Days Warranty</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Every fix includes digital warranty tracking and authentic parts logs.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-xs text-slate-900">Verified Technicians Only</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Vetted shops from Computer Village Ikeja, Yaba, VI, and Lekki.
          </p>
        </div>
      </div>

      {/* Top Nearby Verified Technicians */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Top Rated Technicians Nearby</h3>
          <span className="text-xs text-slate-500">Ikeja, Yaba & VI</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topTechs.map((tech) => (
            <div
              key={tech.userId}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start gap-3">
                <img
                  src={tech.avatarUrl}
                  alt={tech.businessName}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-900 truncate">{tech.businessName}</h4>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{tech.shopLocation.area || tech.shopLocation.city}</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="flex items-center text-xs font-bold text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 mr-0.5" />
                      {tech.rating}
                    </span>
                    <span className="text-[10px] text-slate-400">({tech.completedJobs} jobs)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-semibold">{tech.quoteAccuracyScore}% Quote Accuracy</span>
                <span className="font-medium text-slate-500">~{tech.averageResponseMinutes} min response</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
