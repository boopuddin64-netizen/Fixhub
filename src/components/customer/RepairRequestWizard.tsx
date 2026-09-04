import React, { useState, useEffect } from 'react';
import { DeviceBrand, DeviceModel, RepairIssueOption, LocationCoordinates } from '../../types';
import { ApiClient } from '../../api/client';
import {
  Smartphone,
  Check,
  MapPin,
  Camera,
  ChevronRight,
  ArrowLeft,
  Search,
  Sparkles,
  AlertCircle,
  Clock,
  DollarSign,
  UploadCloud,
  X
} from 'lucide-react';

interface RepairRequestWizardProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
}

export const RepairRequestWizard: React.FC<RepairRequestWizardProps> = ({ onCancel, onRequestCreated }) => {
  const [step, setStep] = useState<number>(1);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [issuesList, setIssuesList] = useState<RepairIssueOption[]>([]);
  
  // Selection State
  const [selectedBrand, setSelectedBrand] = useState<string>('Apple');
  const [selectedModel, setSelectedModel] = useState<string>('iPhone 13');
  const [selectedIssues, setSelectedIssues] = useState<string[]>(['screen_damaged']);
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
  ]);
  const [modelSearch, setModelSearch] = useState<string>('');

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getBrands().then(setBrands).catch(console.error);
    ApiClient.getModels().then(setModels).catch(console.error);
    ApiClient.getIssues().then(setIssuesList).catch(console.error);
  }, []);

  const filteredModels = models.filter(
    (m) =>
      m.brandName.toLowerCase() === selectedBrand.toLowerCase() &&
      m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

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
    try {
      const result = await ApiClient.createRepairRequest({
        customerLocation: location,
        deviceBrand: selectedBrand,
        deviceModel: selectedModel,
        issues: selectedIssues,
        description: description || 'Screen damage needing fast replacement.',
        photos,
      });
      onRequestCreated(result.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request');
      setIsSubmitting(false);
    }
  };

  return (
    <div id="repair-request-wizard" className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Wizard Header with Progress */}
      <div className="bg-slate-900 text-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 mr-1 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Step {step} of 5</span>
              <h2 className="text-lg font-bold text-white leading-tight">
                {step === 1 && 'Select Phone Brand'}
                {step === 2 && `Choose ${selectedBrand} Model`}
                {step === 3 && 'What is the Problem?'}
                {step === 4 && 'Add Photos & Notes'}
                {step === 5 && 'Confirm Location & Submit'}
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-6">
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: SELECT BRAND */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supported Brands</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {brands.map((b) => {
                const isSelected = selectedBrand.toLowerCase() === b.name.toLowerCase();
                return (
                  <button
                    key={b.id}
                    id={`brand-select-${b.name.toLowerCase()}`}
                    onClick={() => {
                      setSelectedBrand(b.name);
                      // Auto pick first model
                      const firstModel = models.find((m) => m.brandName.toLowerCase() === b.name.toLowerCase());
                      if (firstModel) setSelectedModel(firstModel.name);
                    }}
                    className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">{b.name}</span>
                    <span className="text-[11px] text-slate-400">{b.popularModelsCount} models</span>
                  </button>
                );
              })}
            </div>
            <div className="pt-4 flex justify-end">
              <button
                id="wizard-step1-next"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT MODEL */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={`Search ${selectedBrand} models...`}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredModels.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  No model found. You can specify a custom model in details.
                </div>
              ) : (
                filteredModels.map((m) => {
                  const isSelected = selectedModel === m.name;
                  return (
                    <button
                      key={m.id}
                      id={`model-select-${m.id}`}
                      onClick={() => setSelectedModel(m.name)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Released: {m.releaseYear}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Change Brand
              </button>
              <button
                id="wizard-step2-next"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Select Issues</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SELECT ISSUES */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select one or more issues</p>
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
                    id={`issue-chip-${iss.id}`}
                    onClick={() => toggleIssue(iss.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
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

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Model
              </button>
              <button
                id="wizard-step3-next"
                onClick={() => setStep(4)}
                disabled={selectedIssues.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Add Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DETAILS & PHOTOS */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Describe the damage (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Phone fell on concrete. Screen glass shattered, touch is working but flakes near camera..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Photos of Damaged Device
                </label>
                <span className="text-xs text-slate-400">Helps technicians quote accurately</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={url} alt="Damage evidence" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    onClick={handleAddSamplePhoto}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition-all cursor-pointer p-2 text-center"
                  >
                    <UploadCloud className="w-6 h-6 mb-1" />
                    <span className="text-[11px] font-semibold">+ Add Photo</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setStep(3)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Issues
              </button>
              <button
                id="wizard-step4-next"
                onClick={() => setStep(5)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Confirm Location</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: CONFIRM LOCATION & SUBMIT */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Your Repair Location</span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Street Address / Landmark</label>
                <input
                  type="text"
                  value={location.address}
                  onChange={(e) => setLocation({ ...location, address: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
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
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold uppercase">Device to Fix</span>
                <span className="text-xs font-bold text-slate-900">{selectedBrand} {selectedModel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold uppercase">Issues</span>
                <span className="text-xs font-bold text-blue-700">{selectedIssues.length} Reported Issue(s)</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-blue-200/50">
                <span>Fix Hub Escrow Protection</span>
                <span className="text-emerald-700 font-bold">✓ 100% Protected</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setStep(4)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Details
              </button>
              <button
                id="wizard-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-extrabold text-sm px-7 py-3 rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>{isSubmitting ? 'Submitting...' : 'Find Nearby Technicians'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
