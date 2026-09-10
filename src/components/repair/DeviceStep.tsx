import React, { useState, useEffect } from 'react';
import { Smartphone, Plus, CheckCircle2, ArrowRight } from 'lucide-react';
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
    // Snappy conversational advance
    onContinue();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Saved Devices Quick Replies */}
      {savedDevices.length > 0 && (
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Your Saved Devices
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedDevices.map((dev) => {
              const isSelected = currentBrand === dev.brandName && currentModel === dev.modelName;
              return (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => handleQuickSelect(dev)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {dev.brandName} {dev.modelName}
                        </span>
                        {dev.isPrimary && (
                          <span className="px-1.5 py-0.2 bg-slate-900 text-white text-[9px] font-bold rounded-sm shrink-0">
                            Primary
                          </span>
                        )}
                      </div>
                      {dev.nickname && (
                        <p className="text-[10px] text-slate-500 truncate">{dev.nickname}</p>
                      )}
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Choose Another Device Button */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {savedDevices.length > 0 ? 'Or Choose Another Device' : 'Select From Catalog'}
        </label>

        <button
          type="button"
          onClick={() => setIsCatalogModalOpen(true)}
          className="w-full p-3.5 rounded-2xl border border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/40 transition-all flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Browse Full Device Catalog
              </span>
              <p className="text-[11px] text-slate-500">Apple, Samsung, Xiaomi, Tecno, Infinix, iPad...</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600">Select →</span>
        </button>
      </div>

      {/* Selected device summary banner (if already selected but user stayed on this step) */}
      {currentBrand && currentModel && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-wider">Selected Device</span>
              <h4 className="text-xs font-bold text-white">{currentBrand} {currentModel}</h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
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
            onContinue();
          }}
        />
      )}
    </div>
  );
};
