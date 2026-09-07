import React, { useState, useEffect } from 'react';
import { Smartphone, Plus, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { CustomerDevice, DeviceType } from '../../types';
import { DeviceSelectorModal } from '../customer/repair-flow/DeviceSelectorModal';

interface DeviceStepProps {
  currentBrand: string;
  currentModel: string;
  currentDeviceType?: DeviceType;
  onSelectDevice: (device: {
    brandName: string;
    modelName: string;
    deviceModelId?: string;
    deviceType: DeviceType;
    catalogMatch: boolean;
  }) => void;
  onContinue: () => void;
}

export const DeviceStep: React.FC<DeviceStepProps> = ({
  currentBrand,
  currentModel,
  currentDeviceType,
  onSelectDevice,
  onContinue,
}) => {
  const [savedDevices, setSavedDevices] = useState<CustomerDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  useEffect(() => {
    setIsLoadingDevices(true);
    ApiClient.getCustomerDevices()
      .then((devices) => {
        if (devices && Array.isArray(devices)) {
          setSavedDevices(devices);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingDevices(false));
  }, []);

  const handleQuickSelect = (dev: CustomerDevice) => {
    onSelectDevice({
      brandName: dev.brandName,
      modelName: dev.modelName,
      deviceModelId: dev.deviceModelId,
      deviceType: dev.deviceType || 'PHONE',
      catalogMatch: dev.catalogMatch ?? true,
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Which device needs repair?</h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Select from your saved devices or browse the device catalog.
        </p>
      </div>

      {/* Saved Devices Quick Replies */}
      {savedDevices.length > 0 && (
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Your Saved Devices
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedDevices.map((dev) => {
              const isSelected = currentBrand === dev.brandName && currentModel === dev.modelName;
              return (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => handleQuickSelect(dev)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          {dev.brandName} {dev.modelName}
                        </span>
                        {dev.isPrimary && (
                          <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-bold rounded-md">
                            Primary
                          </span>
                        )}
                      </div>
                      {dev.nickname && (
                        <p className="text-[11px] text-slate-500">{dev.nickname}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Choose Another Device Button */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          {savedDevices.length > 0 ? 'Or Choose Another Device' : 'Select Device'}
        </label>

        <button
          type="button"
          onClick={() => setIsCatalogModalOpen(true)}
          className="w-full p-4 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-800">Browse Full Device Catalog</span>
              <p className="text-[11px] text-slate-500">Apple, Samsung, Xiaomi, Tecno, Infinix, iPad...</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600">Select →</span>
        </button>
      </div>

      {/* Selected device summary banner */}
      {currentBrand && currentModel && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Selected Device</span>
              <h4 className="text-sm font-extrabold text-white">{currentBrand} {currentModel}</h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Catalog Selector Modal */}
      {isCatalogModalOpen && (
        <DeviceSelectorModal
          isOpen={isCatalogModalOpen}
          onClose={() => setIsCatalogModalOpen(false)}
          currentBrand={currentBrand}
          currentModel={currentModel}
          onSelectDevice={(d) => {
            onSelectDevice(d);
            setIsCatalogModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
