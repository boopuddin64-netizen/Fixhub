import React, { useState, useEffect } from 'react';
import {
  DeviceBrand,
  DeviceFamily,
  DeviceModel,
  DeviceType,
  CustomerDevice,
} from '../../../types';
import { ApiClient } from '../../../api/client';
import {
  Smartphone,
  Tablet,
  Search,
  ChevronRight,
  ArrowLeft,
  X,
  Check,
  Plus,
  Sparkles
} from 'lucide-react';

interface DeviceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (deviceData: {
    brandName: string;
    modelName: string;
    deviceModelId?: string;
    deviceType: DeviceType;
    catalogMatch: boolean;
    customerDeviceId?: string;
    saveToAccount?: boolean;
  }) => void;
  currentBrand?: string;
  currentModel?: string;
  inline?: boolean;
}

export const DeviceSelectorModal: React.FC<DeviceSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectDevice,
  currentBrand,
  currentModel,
  inline = false,
}) => {
  const [deviceType, setDeviceType] = useState<DeviceType>('PHONE');
  const [savedDevices, setSavedDevices] = useState<CustomerDevice[]>([]);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<DeviceBrand | null>(null);
  const [families, setFamilies] = useState<DeviceFamily[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<DeviceFamily | null>(null);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [popularModels, setPopularModels] = useState<DeviceModel[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{ brands: DeviceBrand[]; models: DeviceModel[] }>({
    brands: [],
    models: [],
  });

  // Manual entry toggle
  const [isManualEntry, setIsManualEntry] = useState<boolean>(false);
  const [manualBrand, setManualBrand] = useState<string>('');
  const [manualModel, setManualModel] = useState<string>('');
  const [saveToAccount, setSaveToAccount] = useState<boolean>(true);

  // Load initial catalog data
  useEffect(() => {
    if (!isOpen) return;
    ApiClient.getCustomerDevices().then(setSavedDevices).catch(() => []);
    ApiClient.getBrands(deviceType).then(setBrands).catch(() => []);
    ApiClient.getModels({ popular: true, deviceType }).then(setPopularModels).catch(() => []);
  }, [isOpen, deviceType]);

  // Load families when brand changes
  useEffect(() => {
    if (selectedBrand) {
      ApiClient.getFamilies(selectedBrand.id, deviceType).then(setFamilies).catch(() => []);
      ApiClient.getModels({ brandId: selectedBrand.id, deviceType }).then(setModels).catch(() => []);
    } else {
      setFamilies([]);
      setModels([]);
    }
  }, [selectedBrand, deviceType]);

  // Filter models when family changes
  useEffect(() => {
    if (selectedBrand && selectedFamily) {
      ApiClient.getModels({ brandId: selectedBrand.id, familyId: selectedFamily.id, deviceType })
        .then(setModels)
        .catch(() => []);
    }
  }, [selectedFamily, selectedBrand, deviceType]);

  // Live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ brands: [], models: [] });
      return;
    }
    const timer = setTimeout(() => {
      ApiClient.searchDevices(searchQuery, deviceType)
        .then(setSearchResults)
        .catch(() => setSearchResults({ brands: [], models: [] }));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, deviceType]);

  if (!isOpen) return null;

  const handleSelectModel = (model: DeviceModel) => {
    onSelectDevice({
      brandName: model.brandName,
      modelName: model.name,
      deviceModelId: model.id,
      deviceType: model.deviceType || deviceType,
      catalogMatch: true,
    });
    onClose();
  };

  const handleSelectSavedDevice = (dev: CustomerDevice) => {
    onSelectDevice({
      brandName: dev.brandName,
      modelName: dev.modelName,
      deviceModelId: dev.deviceModelId,
      deviceType: dev.deviceType,
      catalogMatch: dev.catalogMatch,
      customerDeviceId: dev.id,
    });
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBrand.trim() || !manualModel.trim()) return;

    onSelectDevice({
      brandName: manualBrand.trim(),
      modelName: manualModel.trim(),
      deviceType,
      catalogMatch: false,
      saveToAccount,
    });
    onClose();
  };

  if (!isOpen && !inline) return null;

  const content = (
    <div className={`w-full max-w-lg bg-white rounded-3xl overflow-hidden flex flex-col ${inline ? 'border border-slate-200' : 'shadow-2xl border border-slate-200 max-h-[90vh]'}`}>
      {/* Header */}
      {!inline && (
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {selectedBrand && !searchQuery ? (
              <button type="button"
                onClick={() => {
                  if (selectedFamily) setSelectedFamily(null);
                  else setSelectedBrand(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <div>
              <h3 className="text-base font-black text-slate-900">
                {selectedFamily
                  ? selectedFamily.name
                  : selectedBrand
                  ? `${selectedBrand.name} Models`
                  : 'Select Your Device'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {selectedBrand
                  ? 'Choose the model that needs repair'
                  : 'Pick from your saved devices or browse catalog'}
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* When inline, we might still want a back button if we are deep in selection */}
      {inline && (selectedBrand || selectedFamily) && !searchQuery && (
        <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <button type="button"
            onClick={() => {
              if (selectedFamily) setSelectedFamily(null);
              else setSelectedBrand(null);
            }}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      )}

      {/* Device Type Toggle (Phone vs Tablet) */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
            <button type="button"
              onClick={() => {
                setDeviceType('PHONE');
                setSelectedBrand(null);
                setSelectedFamily(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                deviceType === 'PHONE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phones</span>
            </button>
            <button type="button"
              onClick={() => {
                setDeviceType('TABLET');
                setSelectedBrand(null);
                setSelectedFamily(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                deviceType === 'TABLET'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablets / iPads</span>
            </button>
          </div>
          <button type="button"
            onClick={() => setIsManualEntry(!isManualEntry)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
          >
            {isManualEntry ? 'Browse Catalog' : 'Manual Entry'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Manual Device Entry Form */}
          {isManualEntry ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
                Can&apos;t find your exact phone? Enter the brand and model name below.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Brand Name</label>
                <input
                  type="text"
                  placeholder="e.g., Tecno, Infinix, Google, Vivo"
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Model Name</label>
                <input
                  type="text"
                  placeholder="e.g., Spark 10 Pro, Hot 30i, Pixel 7a"
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveToAccount}
                  onChange={(e) => setSaveToAccount(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-700">Save this device to my Fix Hub profile</span>
              </label>

              <button type="submit"
                disabled={!manualBrand.trim() || !manualModel.trim()}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Use this device
              </button>
            </form>
          ) : (
            <>
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search device (e.g., iPhone 13, A54, Spark 10)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Search Results Mode */}
              {searchQuery.trim() ? (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Search Results
                  </span>
                  {searchResults.models.length === 0 && searchResults.brands.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No matching devices found. You can use manual entry above.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {searchResults.models.map((model) => (
                        <div
                          key={model.id}
                          onClick={() => handleSelectModel(model)}
                          className="p-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 flex items-center justify-between cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {model.brandName} {model.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {model.familyName || model.deviceType}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedBrand ? (
                /* Selected Brand Mode: Show Families & Models */
                <div className="space-y-3">
                  {/* Family Filter if available */}
                  {families.length > 0 && !selectedFamily && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Product Series
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {families.map((fam) => (
                          <div
                            key={fam.id}
                            onClick={() => setSelectedFamily(fam)}
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 cursor-pointer flex items-center justify-between transition-all"
                          >
                            <span className="text-xs font-bold text-slate-800">{fam.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Model List */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {selectedFamily ? `${selectedFamily.name} Models` : 'All Models'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                      {models.map((model) => (
                        <div
                          key={model.id}
                          onClick={() => handleSelectModel(model)}
                          className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-all"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{model.name}</p>
                            <p className="text-[10px] text-slate-400">Released {model.releaseYear}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Default View: Saved Devices + Popular Models + Brand List */
                <div className="space-y-4">
                  {/* Customer's Saved Devices */}
                  {savedDevices.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        My Saved Devices
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {savedDevices.map((dev) => (
                          <div
                            key={dev.id}
                            onClick={() => handleSelectSavedDevice(dev)}
                            className="p-3 rounded-2xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-all"
                          >
                            <div className="flex items-center gap-2.5">
                              <Smartphone className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {dev.brandName} {dev.modelName}
                                </p>
                                <p className="text-[10px] text-blue-700 font-medium">
                                  {dev.nickname || (dev.isPrimary ? 'Primary Phone' : 'Saved')}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-blue-600">Select</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Browse Brands */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Browse by Brand
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {brands.map((brand) => (
                        <button type="button"
                          key={brand.id}
                          onClick={() => setSelectedBrand(brand)}
                          className="p-3 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between cursor-pointer transition-all text-left"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{brand.name}</p>
                            <p className="text-[10px] text-slate-400">{brand.modelsCount} models</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
  
  if (inline) return content;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      {content}
    </div>
  );
};
