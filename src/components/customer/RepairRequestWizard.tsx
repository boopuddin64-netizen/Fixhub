import React, { useState, useEffect } from 'react';
import {
  DeviceBrand,
  DeviceFamily,
  DeviceModel,
  DeviceType,
  CustomerDevice,
  RepairIssueOption,
  LocationCoordinates,
} from '../../types';
import { ApiClient } from '../../api/client';
import {
  Smartphone,
  Tablet,
  Check,
  MapPin,
  ChevronRight,
  ArrowLeft,
  Search,
  Sparkles,
  AlertCircle,
  Clock,
  UploadCloud,
  X,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface RepairRequestWizardProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
  preselectedDevice?: CustomerDevice | null;
  preselectedBrand?: string;
  preselectedModel?: string;
  preselectedIssue?: string;
}

export const RepairRequestWizard: React.FC<RepairRequestWizardProps> = ({
  onCancel,
  onRequestCreated,
  preselectedDevice,
  preselectedBrand,
  preselectedModel,
  preselectedIssue,
}) => {
  const [step, setStep] = useState<number>(1);

  // Saved Devices
  const [savedDevices, setSavedDevices] = useState<CustomerDevice[]>([]);
  const [selectedSavedDeviceId, setSelectedSavedDeviceId] = useState<string | null>(
    preselectedDevice?.id || null
  );

  // Catalog State
  const [deviceType, setDeviceType] = useState<DeviceType>(
    preselectedDevice?.deviceType || 'PHONE'
  );
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>(
    preselectedDevice?.brandName || preselectedBrand || 'Apple'
  );
  const [families, setFamilies] = useState<DeviceFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [popularModels, setPopularModels] = useState<DeviceModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    preselectedDevice?.modelName || preselectedModel || 'iPhone 13'
  );
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    preselectedDevice?.deviceModelId
  );
  const [modelSearch, setModelSearch] = useState<string>('');

  // Custom Device Entry State
  const [isCustomDevice, setIsCustomDevice] = useState<boolean>(
    preselectedDevice ? !preselectedDevice.catalogMatch : false
  );
  const [customBrandName, setCustomBrandName] = useState<string>(
    preselectedDevice && !preselectedDevice.catalogMatch ? preselectedDevice.brandName : ''
  );
  const [customModelName, setCustomModelName] = useState<string>(
    preselectedDevice && !preselectedDevice.catalogMatch ? preselectedDevice.modelName : ''
  );
  const [saveToMyDevices, setSaveToMyDevices] = useState<boolean>(false);

  // Issue & Description State
  const [issuesList, setIssuesList] = useState<RepairIssueOption[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<string[]>(
    preselectedIssue ? [preselectedIssue] : ['screen_damaged']
  );
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
  ]);

  // Location State
  const [location, setLocation] = useState<LocationCoordinates>({
    lat: 6.5964,
    lng: 3.3421,
    address: '14 Allen Avenue, Ikeja',
    landmark: 'Opposite Oshopey Plaza',
    area: 'Ikeja',
    city: 'Lagos',
    state: 'Lagos State',
  });

  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Initial Data
  useEffect(() => {
    ApiClient.getCustomerDevices()
      .then((devs) => {
        setSavedDevices(devs);
        if (preselectedDevice) {
          setSelectedSavedDeviceId(preselectedDevice.id);
        } else if (devs.length > 0 && !preselectedBrand && !preselectedModel) {
          const primary = devs.find((d) => d.isPrimary) || devs[0];
          setSelectedSavedDeviceId(primary.id);
          setSelectedBrand(primary.brandName);
          setSelectedModel(primary.modelName);
          setSelectedModelId(primary.deviceModelId);
          setDeviceType(primary.deviceType);
          setIsCustomDevice(!primary.catalogMatch);
        }
      })
      .catch(console.error);

    ApiClient.getIssues().then(setIssuesList).catch(console.error);
    ApiClient.getModels({ popular: true, deviceType }).then(setPopularModels).catch(console.error);
  }, []);

  // Refresh brands and popular models on device type change
  useEffect(() => {
    ApiClient.getBrands(deviceType).then(setBrands).catch(console.error);
    ApiClient.getModels({ popular: true, deviceType }).then(setPopularModels).catch(console.error);
  }, [deviceType]);

  // Load Families when brand changes
  useEffect(() => {
    if (!selectedBrand || isCustomDevice) return;
    const brandObj = brands.find((b) => b.name.toLowerCase() === selectedBrand.toLowerCase());
    if (brandObj) {
      ApiClient.getFamilies(brandObj.id, deviceType)
        .then((fams) => {
          setFamilies(fams);
          setSelectedFamilyId('');
        })
        .catch(console.error);
    }
  }, [selectedBrand, brands, deviceType, isCustomDevice]);

  // Load Models when brand or family changes
  useEffect(() => {
    if (!selectedBrand || isCustomDevice) return;
    const brandObj = brands.find((b) => b.name.toLowerCase() === selectedBrand.toLowerCase());
    if (brandObj) {
      setIsLoadingCatalog(true);
      ApiClient.getModels({
        brandId: brandObj.id,
        familyId: selectedFamilyId || undefined,
        deviceType,
      })
        .then((modelList) => {
          setModels(modelList);
          if (modelList.length > 0 && !modelList.some((m) => m.name === selectedModel)) {
            setSelectedModel(modelList[0].name);
            setSelectedModelId(modelList[0].id);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [selectedBrand, selectedFamilyId, brands, deviceType, isCustomDevice]);

  const handleSelectSavedDevice = (dev: CustomerDevice) => {
    setSelectedSavedDeviceId(dev.id);
    setSelectedBrand(dev.brandName);
    setSelectedModel(dev.modelName);
    setSelectedModelId(dev.deviceModelId);
    setDeviceType(dev.deviceType);
    setIsCustomDevice(!dev.catalogMatch);
    if (!dev.catalogMatch) {
      setCustomBrandName(dev.brandName);
      setCustomModelName(dev.modelName);
    }
  };

  const handleSelectCatalogBrand = (brandName: string) => {
    setSelectedSavedDeviceId(null);
    setIsCustomDevice(false);
    setSelectedBrand(brandName);
    const firstModel = models.find((m) => m.brandName.toLowerCase() === brandName.toLowerCase());
    if (firstModel) {
      setSelectedModel(firstModel.name);
      setSelectedModelId(firstModel.id);
    }
  };

  const handleSelectPopularModel = (model: DeviceModel) => {
    setSelectedSavedDeviceId(null);
    setIsCustomDevice(false);
    setSelectedBrand(model.brandName);
    setSelectedModel(model.name);
    setSelectedModelId(model.id);
    setDeviceType(model.deviceType);
  };

  const toggleIssue = (issueId: string) => {
    if (selectedIssues.includes(issueId)) {
      if (selectedIssues.length > 1) {
        setSelectedIssues(selectedIssues.filter((id) => id !== issueId));
      }
    } else {
      setSelectedIssues([...selectedIssues, issueId]);
    }
  };

  const handleAddSamplePhoto = () => {
    const samplePool = [
      'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80',
    ];
    const nextPhoto = samplePool[photos.length % samplePool.length];
    setPhotos([...photos, nextPhoto]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const finalBrand = isCustomDevice ? customBrandName.trim() : selectedBrand;
    const finalModel = isCustomDevice ? customModelName.trim() : selectedModel;

    if (!finalBrand || !finalModel) {
      setErrorMsg('Brand name and model name are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await ApiClient.createRepairRequest({
        customerLocation: location,
        deviceBrand: finalBrand,
        deviceModel: finalModel,
        deviceModelId: selectedModelId,
        deviceType,
        catalogMatch: !isCustomDevice,
        issues: selectedIssues,
        description: description || 'Damage inspection needed.',
        photos,
      });

      if (saveToMyDevices && !selectedSavedDeviceId) {
        await ApiClient.addCustomerDevice({
          brandName: finalBrand,
          modelName: finalModel,
          deviceModelId: selectedModelId,
          deviceType,
          catalogMatch: !isCustomDevice,
          isPrimary: savedDevices.length === 0,
        }).catch((err) => console.warn('Failed to save device bookmark:', err));
      }

      onRequestCreated(result.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit repair request');
      setIsSubmitting(false);
    }
  };

  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div id="repair-request-wizard" className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Wizard Header with Progress */}
      <div className="bg-slate-950 text-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/30">
                  Step {step} of 4
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Escrow Guaranteed</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight mt-1">
                {step === 1 && 'Select Your Device'}
                {step === 2 && 'What Needs Fixing?'}
                {step === 3 && 'Damage Photos & Notes'}
                {step === 4 && 'Confirm Location & Book'}
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ===================== STEP 1: SELECT DEVICE ===================== */}
        {step === 1 && (
          <div className="space-y-5">
            {/* 1. Saved Devices Quick Picker */}
            {savedDevices.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    My Saved Devices
                  </span>
                  <span className="text-[11px] text-blue-600 font-semibold">1-Tap Select</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedDevices.map((dev) => {
                    const isSelected = selectedSavedDeviceId === dev.id;
                    return (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => handleSelectSavedDevice(dev)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {dev.deviceType === 'TABLET' ? (
                              <Tablet className="w-4 h-4" />
                            ) : (
                              <Smartphone className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {dev.brandName} {dev.modelName}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {dev.nickname ? `"${dev.nickname}" • ` : ''}
                              {dev.color || 'Standard'}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                {savedDevices.length > 0 ? 'Or Choose Another Device' : 'Choose Device from Catalog'}
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Device Type & Custom Model Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setDeviceType('PHONE');
                    setSelectedSavedDeviceId(null);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    deviceType === 'PHONE'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Smartphones</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceType('TABLET');
                    setSelectedSavedDeviceId(null);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    deviceType === 'TABLET'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablets / iPads</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCustomDevice(!isCustomDevice);
                  setSelectedSavedDeviceId(null);
                }}
                className="text-xs text-blue-600 hover:underline font-semibold text-right cursor-pointer"
              >
                {isCustomDevice ? '← Back to Verified Catalog' : "Can't find your model? Enter custom device"}
              </button>
            </div>

            {/* Custom Device Entry or Catalog Discovery */}
            {isCustomDevice ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Manual Device Entry
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customBrandName}
                      onChange={(e) => setCustomBrandName(e.target.value)}
                      placeholder="e.g. Itel, Nokia, Huawei, OnePlus"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Model Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                      placeholder="e.g. A70, G21, P30 Pro"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Technicians will inspect your custom model specifications during quote formulation.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Popular Models Shortcuts */}
                {popularModels.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Popular Models in Nigeria
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {popularModels.slice(0, 7).map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => handleSelectPopularModel(pm)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer ${
                            selectedModel === pm.name && !selectedSavedDeviceId
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {pm.brandName} {pm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brands Grid */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Brand
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {brands.map((b) => {
                      const isSelected =
                        selectedBrand.toLowerCase() === b.name.toLowerCase() && !selectedSavedDeviceId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          id={`wizard-brand-${b.name.toLowerCase()}`}
                          onClick={() => handleSelectCatalogBrand(b.name)}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 shadow-xs ring-1 ring-blue-600/30'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-900 truncate w-full">{b.name}</span>
                          <span className="text-[10px] text-slate-400">{b.popularModelsCount || 'Many'} models</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model Selection & Search */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {selectedBrand} Models
                    </span>
                    {families.length > 0 && (
                      <select
                        value={selectedFamilyId}
                        onChange={(e) => setSelectedFamilyId(e.target.value)}
                        className="text-xs p-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                      >
                        <option value="">All {selectedBrand} Series</option>
                        {families.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={`Search ${selectedBrand} models...`}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {isLoadingCatalog ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Loading catalog...</span>
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-2">
                        <p>No catalog model found matching "{modelSearch}".</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomDevice(true);
                            setCustomBrandName(selectedBrand);
                            setCustomModelName(modelSearch);
                          }}
                          className="text-blue-600 font-bold hover:underline"
                        >
                          Use "{modelSearch}" as custom model →
                        </button>
                      </div>
                    ) : (
                      filteredModels.map((m) => {
                        const isSelected = selectedModel === m.name && !selectedSavedDeviceId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            id={`model-select-${m.id}`}
                            onClick={() => {
                              setSelectedSavedDeviceId(null);
                              setSelectedModel(m.name);
                              setSelectedModelId(m.id);
                            }}
                            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">{m.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {m.familyName || m.deviceType} • Released {m.releaseYear}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Save to My Devices Checkbox */}
            {!selectedSavedDeviceId && (
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToMyDevices}
                  onChange={(e) => setSaveToMyDevices(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">
                  Save this device to "My Devices" for 1-tap booking in the future
                </span>
              </label>
            )}

            {/* Step 1 Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Selected:{' '}
                <strong className="text-slate-900">
                  {isCustomDevice
                    ? `${customBrandName || 'Custom'} ${customModelName}`
                    : `${selectedBrand} ${selectedModel}`}
                </strong>
              </span>
              <button
                id="wizard-step1-next"
                type="button"
                onClick={() => setStep(2)}
                disabled={isCustomDevice && (!customBrandName.trim() || !customModelName.trim())}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Select Issues</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 2: SELECT ISSUES ===================== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select one or more issues to fix
              </p>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                {selectedIssues.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {issuesList.map((iss) => {
                const isSelected = selectedIssues.includes(iss.id);
                return (
                  <button
                    key={iss.id}
                    type="button"
                    id={`issue-chip-${iss.id}`}
                    onClick={() => toggleIssue(iss.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">{iss.label}</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{iss.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> ~{iss.estimatedLaborMinutes} mins
                        </span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">
                          ₦{iss.typicalCostRangeNaira[0].toLocaleString()} - ₦{iss.typicalCostRangeNaira[1].toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Device
              </button>
              <button
                id="wizard-step2-next"
                type="button"
                onClick={() => setStep(3)}
                disabled={selectedIssues.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Add Details & Photos</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 3: DETAILS & PHOTOS ===================== */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Describe What Happened (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Phone fell on asphalt. Glass cracked, touch still works but flickers near top speaker..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Photos of Damaged Device
                </label>
                <span className="text-[11px] text-slate-400">Enables accurate technician quotes</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={url} alt="Damage evidence" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddSamplePhoto}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition-all cursor-pointer p-2 text-center"
                  >
                    <UploadCloud className="w-6 h-6 mb-1" />
                    <span className="text-[11px] font-semibold">+ Add Photo</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Issues
              </button>
              <button
                id="wizard-step3-next"
                type="button"
                onClick={() => setStep(4)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Confirm Location & Book</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 4: LOCATION & CONFIRM ===================== */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Service Location in Lagos</span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Street Address</label>
                <input
                  type="text"
                  value={location.address}
                  onChange={(e) => setLocation({ ...location, address: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-1">Area / Landmark</label>
                  <input
                    type="text"
                    value={location.landmark || ''}
                    onChange={(e) => setLocation({ ...location, landmark: e.target.value, area: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    placeholder="e.g. Opposite Slot Ikeja"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-1">City / State</label>
                  <input
                    type="text"
                    value={`${location.city}, ${location.state}`}
                    readOnly
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Summary Review Card */}
            <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold uppercase">Device</span>
                <span className="text-xs font-bold text-slate-900">
                  {isCustomDevice ? `${customBrandName} ${customModelName}` : `${selectedBrand} ${selectedModel}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold uppercase">Selected Issues</span>
                <span className="text-xs font-bold text-blue-700">{selectedIssues.length} issue(s) reported</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-blue-200/50">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fix Hub Escrow Protection</span>
                </span>
                <span className="text-emerald-700 font-bold">100% Protected</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Photos
              </button>
              <button
                id="wizard-submit-btn"
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-extrabold text-xs sm:text-sm px-7 py-3 rounded-2xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Broadcasting Request...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Find Nearby Technicians</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
