import React, { useState, useEffect } from 'react';
import { CustomerDevice, DeviceBrand, DeviceFamily, DeviceModel, DeviceType } from '../../types';
import { ApiClient } from '../../api/client';
import {
  Smartphone,
  Tablet,
  Plus,
  Trash2,
  Star,
  Edit2,
  Check,
  X,
  AlertCircle,
  Search,
  Wrench,
  Loader2
} from 'lucide-react';

interface SavedDevicesManagerProps {
  onClose: () => void;
  onSelectDeviceForRepair?: (device: CustomerDevice) => void;
}

export const SavedDevicesManager: React.FC<SavedDevicesManagerProps> = ({
  onClose,
  onSelectDeviceForRepair,
}) => {
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit Device Modal State
  const [isAddingDevice, setIsAddingDevice] = useState<boolean>(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  // Form State
  const [deviceType, setDeviceType] = useState<DeviceType>('PHONE');
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('Apple');
  const [families, setFamilies] = useState<DeviceFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSearch, setModelSearch] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [customBrandName, setCustomBrandName] = useState<string>('');
  const [customModelName, setCustomModelName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [storage, setStorage] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getCustomerDevices();
      setDevices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    ApiClient.getBrands(deviceType).then(setBrands).catch(console.error);
  }, [deviceType]);

  // Load families when brand changes
  useEffect(() => {
    if (!selectedBrand) return;
    const brandObj = brands.find((b) => b.name.toLowerCase() === selectedBrand.toLowerCase());
    if (brandObj) {
      ApiClient.getFamilies(brandObj.id, deviceType).then((fams) => {
        setFamilies(fams);
        setSelectedFamilyId(fams.length > 0 ? fams[0].id : '');
      }).catch(console.error);
    }
  }, [selectedBrand, brands, deviceType]);

  // Load models when family or brand changes
  useEffect(() => {
    if (!selectedBrand) return;
    const brandObj = brands.find((b) => b.name.toLowerCase() === selectedBrand.toLowerCase());
    if (brandObj) {
      ApiClient.getModels({
        brandId: brandObj.id,
        familyId: selectedFamilyId || undefined,
        deviceType,
      }).then((modelList) => {
        setModels(modelList);
        if (modelList.length > 0 && !selectedModel) {
          setSelectedModel(modelList[0].name);
        }
      }).catch(console.error);
    }
  }, [selectedBrand, selectedFamilyId, brands, deviceType]);

  const handleSetPrimary = async (deviceId: string) => {
    try {
      await ApiClient.setPrimaryCustomerDevice(deviceId);
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          isPrimary: d.id === deviceId,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update primary device');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm('Remove this device from your saved devices?')) return;
    try {
      await ApiClient.deleteCustomerDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete device');
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const finalBrand = isCustomModel ? customBrandName.trim() : selectedBrand;
      const finalModel = isCustomModel ? customModelName.trim() : selectedModel;

      if (!finalBrand || !finalModel) {
        setError('Brand name and model name are required.');
        setIsSubmitting(false);
        return;
      }

      if (editingDeviceId) {
        // Edit existing device
        const updated = await ApiClient.updateCustomerDevice(editingDeviceId, {
          nickname: nickname.trim() || undefined,
          color: color.trim() || undefined,
          storage: storage.trim() || undefined,
          isPrimary,
        });
        setDevices((prev) => prev.map((d) => (d.id === editingDeviceId ? updated : d)));
      } else {
        // Add new device
        const matchedModel = models.find((m) => m.name === finalModel);
        const newDev = await ApiClient.addCustomerDevice({
          brandName: finalBrand,
          modelName: finalModel,
          deviceModelId: matchedModel?.id,
          deviceType,
          nickname: nickname.trim() || undefined,
          color: color.trim() || undefined,
          storage: storage.trim() || undefined,
          isPrimary,
          catalogMatch: !isCustomModel,
        });
        setDevices((prev) => [newDev, ...prev]);
      }

      // Reset form
      setIsAddingDevice(false);
      setEditingDeviceId(null);
      setNickname('');
      setColor('');
      setStorage('');
      setIsCustomModel(false);
      setCustomBrandName('');
      setCustomModelName('');
      setIsPrimary(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditDevice = (dev: CustomerDevice) => {
    setEditingDeviceId(dev.id);
    setSelectedBrand(dev.brandName);
    setSelectedModel(dev.modelName);
    setDeviceType(dev.deviceType);
    setNickname(dev.nickname || '');
    setColor(dev.color || '');
    setStorage(dev.storage || '');
    setIsPrimary(dev.isPrimary);
    setIsCustomModel(!dev.catalogMatch);
    if (!dev.catalogMatch) {
      setCustomBrandName(dev.brandName);
      setCustomModelName(dev.modelName);
    }
    setIsAddingDevice(true);
  };

  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div
      id="saved-devices-manager-modal"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">My Saved Devices</h3>
              <p className="text-xs text-slate-400">Manage phones and tablets for 1-tap repair requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form to Add or Edit Device */}
          {isAddingDevice ? (
            <form onSubmit={handleSaveDevice} className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="text-sm font-bold text-slate-900">
                  {editingDeviceId ? 'Edit Device Details' : 'Add New Device'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingDevice(false);
                    setEditingDeviceId(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {!editingDeviceId && (
                <>
                  {/* Device Type Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeviceType('PHONE')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        deviceType === 'PHONE'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Smartphone</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceType('TABLET')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        deviceType === 'TABLET'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Tablet className="w-4 h-4" />
                      <span>Tablet / iPad</span>
                    </button>
                  </div>

                  {/* Catalog or Custom Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Device Source</span>
                    <button
                      type="button"
                      onClick={() => setIsCustomModel(!isCustomModel)}
                      className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      {isCustomModel ? '← Pick from Verified Catalog' : '+ Enter custom brand / model'}
                    </button>
                  </div>

                  {isCustomModel ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
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
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Model Name *</label>
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
                  ) : (
                    <div className="space-y-3">
                      {/* Brand Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                        <select
                          value={selectedBrand}
                          onChange={(e) => {
                            setSelectedBrand(e.target.value);
                            setSelectedModel('');
                          }}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Family Select if available */}
                      {families.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Device Series</label>
                          <select
                            value={selectedFamilyId}
                            onChange={(e) => setSelectedFamilyId(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">All Series</option>
                            {families.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Model Select with Search */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder="Filter model name..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                        >
                          {filteredModels.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name} ({m.releaseYear})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Optional Customization: Nickname, Color, Storage */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Daily Driver, Work"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Midnight, Blue"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Storage</label>
                  <input
                    type="text"
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    placeholder="e.g. 128GB, 256GB"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Primary Device Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">Set as my primary daily device</span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingDevice(false);
                    setEditingDeviceId(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingDeviceId ? 'Update Device' : 'Save Device'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {devices.length} {devices.length === 1 ? 'Device' : 'Devices'} Registered
              </span>
              <button
                id="add-new-device-btn"
                onClick={() => {
                  setEditingDeviceId(null);
                  setIsAddingDevice(true);
                }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Device</span>
              </button>
            </div>
          )}

          {/* List of Saved Devices */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading your devices...</span>
            </div>
          ) : devices.length === 0 && !isAddingDevice ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 space-y-3">
              <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-800">No saved devices yet</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Save your iPhone, Samsung, Tecno, or tablet to book repairs with a single tap.
                </p>
              </div>
              <button
                onClick={() => setIsAddingDevice(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your First Device</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  id={`saved-device-card-${dev.id}`}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    dev.isPrimary
                      ? 'border-blue-500/60 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                        dev.isPrimary
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {dev.deviceType === 'TABLET' ? (
                        <Tablet className="w-5 h-5" />
                      ) : (
                        <Smartphone className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {dev.brandName} {dev.modelName}
                        </h4>
                        {dev.isPrimary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold tracking-wide">
                            <Star className="w-2.5 h-2.5 fill-white" /> Primary
                          </span>
                        )}
                        {!dev.catalogMatch && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            Custom
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        {dev.nickname && (
                          <span className="font-medium text-slate-700">"{dev.nickname}"</span>
                        )}
                        {dev.color && <span>• {dev.color}</span>}
                        {dev.storage && <span>• {dev.storage}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {onSelectDeviceForRepair && (
                      <button
                        onClick={() => onSelectDeviceForRepair(dev)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Book Repair for this device"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Repair</span>
                      </button>
                    )}

                    {!dev.isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(dev.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Set as primary"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => startEditDevice(dev)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit device details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteDevice(dev.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Delete saved device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>🔒 Devices are securely linked to your customer account</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
