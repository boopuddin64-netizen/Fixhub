import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, Paperclip, Send, MapPin, Bot, User, Check, AlertCircle, Loader2, Search } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { DeviceBrand, DeviceModel, DeviceType } from '../../types';
import { DeviceSelectorModal } from './repair-flow/DeviceSelectorModal';
import { IssueSelector } from './repair-flow/IssueSelector';
import { LocationSelector } from './repair-flow/LocationSelector';
import { PhotoEvidenceUploader } from './repair-flow/PhotoEvidenceUploader';
import { TechnicianRadarHandoff } from './repair-flow/TechnicianRadarHandoff';
import { VoiceNoteRecorder } from './repair-flow/VoiceNoteRecorder';

interface RepairRequestWizardProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
  preselectedDevice?: string;
  preselectedBrand?: string;
  preselectedModel?: string;
  preselectedIssue?: string;
}

const BotMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-end gap-2 animate-fadeIn w-full max-w-lg">
    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mb-1">
      <Bot className="w-3.5 h-3.5 text-emerald-700" />
    </div>
    <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-slate-100 shadow-sm text-sm text-slate-700">
      {children}
    </div>
  </div>
);

const UserMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-end justify-end gap-2 animate-fadeIn w-full">
    <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-emerald-600 text-white shadow-sm text-sm">
      {children}
    </div>
  </div>
);

export const RepairRequestWizard: React.FC<RepairRequestWizardProps> = ({
  onCancel,
  onRequestCreated,
  preselectedDevice,
  preselectedBrand,
  preselectedModel,
  preselectedIssue,
}) => {
  const [step, setStep] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);

  // Data State
  const [deviceBrand, setDeviceBrand] = useState<string>(preselectedBrand || '');
  const [deviceModel, setDeviceModel] = useState<string>(preselectedModel || '');
  const [deviceModelId, setDeviceModelId] = useState<string | undefined>();
  const [deviceType, setDeviceType] = useState<DeviceType>('PHONE');
  const [catalogMatch, setCatalogMatch] = useState(false);

  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [otherDescription, setOtherDescription] = useState<string>('');
  
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | undefined>();
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number | undefined>();

  const [location, setLocation] = useState<{ lat?: number; lng?: number; address?: string; area?: string; city?: string; state?: string } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  // Issues context
  const [issueDict, setIssueDict] = useState<Record<string, string>>({});
  const saveTimeoutRef = useRef<number | null>(null);

  // Load drafts on mount
  useEffect(() => {
    ApiClient.getRepairDraft()
      .then((draft) => {
        if (draft && draft.deviceBrand && draft.deviceModel && !preselectedDevice && !preselectedModel) {
          if (draft.step) setStep(draft.step);
          if (draft.deviceBrand) setDeviceBrand(draft.deviceBrand);
          if (draft.deviceModel) setDeviceModel(draft.deviceModel);
          if (draft.deviceModelId) setDeviceModelId(draft.deviceModelId);
          if (draft.deviceType) setDeviceType(draft.deviceType);
          if (draft.catalogMatch !== undefined) setCatalogMatch(draft.catalogMatch);
          if (draft.issues) setSelectedIssueIds(draft.issues);
          if (draft.otherDescription) setOtherDescription(draft.otherDescription);
          if (draft.description) setDescription(draft.description);
          if (draft.voiceNoteUrl) setVoiceNoteUrl(draft.voiceNoteUrl);
          if (draft.voiceNoteDurationSeconds) setVoiceNoteDuration(draft.voiceNoteDurationSeconds);
          if (draft.photos) setPhotos(draft.photos);
          if (draft.customerLocation) setLocation(draft.customerLocation);
          return;
        } 
        
        if (!preselectedDevice && !preselectedBrand && !preselectedModel) {
          ApiClient.getCustomerDevices()
            .then((devices) => {
              if (devices && devices.length > 0) {
                const primary = devices.find((d) => d.isPrimary) || devices[0];
                if (primary) {
                  setDeviceBrand(primary.brandName);
                  setDeviceModel(primary.modelName);
                  setDeviceModelId(primary.deviceModelId);
                  if (primary.deviceType) setDeviceType(primary.deviceType);
                  if (primary.catalogMatch !== undefined) setCatalogMatch(primary.catalogMatch);
                  setStep(2);
                }
              }
            })
            .catch(() => {});
        }

        if (!location) {
          ApiClient.getSession()
            .then((session) => {
              if (session?.customerProfile?.defaultLocation) {
                setLocation(session.customerProfile.defaultLocation);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [preselectedDevice, preselectedBrand, preselectedModel]);

  // Debounced Auto-Save
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      if (!deviceBrand && !deviceModel && selectedIssueIds.length === 0 && !description && !voiceNoteUrl && photos.length === 0 && !location) {
        return;
      }
      ApiClient.saveRepairDraft({
        step,
        deviceBrand,
        deviceModel,
        deviceModelId,
        deviceType,
        catalogMatch,
        issues: selectedIssueIds,
        otherDescription,
        description,
        voiceNoteUrl,
        voiceNoteDurationSeconds: voiceNoteDuration,
        photos: photos.slice(0, 3),
        customerLocation: location,
      }).catch(() => {});
    }, 1200);
  }, [step, deviceBrand, deviceModel, deviceModelId, deviceType, catalogMatch, selectedIssueIds, otherDescription, description, voiceNoteUrl, voiceNoteDuration, photos, location]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, deviceBrand, selectedIssueIds.length, photos.length, voiceNoteUrl, location, submitError]);

  const handleSubmitRequest = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const requestPayload = {
        deviceBrand,
        deviceModel,
        deviceModelId,
        deviceType,
        catalogMatch,
        issues: selectedIssueIds,
        otherDescription: otherDescription.trim() || undefined,
        description: description.trim() || 'Repair needed',
        photos: photos.slice(0, 3),
        attachments: [], 
        voiceNoteUrl,
        customerLocation: location,
      };

      const created = await ApiClient.createRepairRequest(requestPayload);
      setCreatedRequestId(created.id);
      setStep(6);
    } catch (err: any) {
      console.error('Failed to create repair request:', err);
      setSubmitError(err.message || 'Could not submit repair request. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] bg-[#f0f2f5] rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative">
       {/* Header */}
       <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
               <Bot className="w-5 h-5 text-emerald-600" />
             </div>
             <div>
               <h3 className="text-sm font-bold text-slate-900">Fix Hub Assistant</h3>
               <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
               </p>
             </div>
          </div>
          <button onClick={onCancel} className="text-xs font-bold text-slate-500 hover:bg-slate-100 p-2 rounded-xl transition-colors">Close</button>
       </div>

       {/* Chat Stream */}
       <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5">
          <BotMessage>
            <p>Hey there! I'm here to help you get your device fixed fast.</p>
            <p className="mt-1">Which device needs repair today?</p>
          </BotMessage>

          {step === 1 ? (
             <div className="pl-9 pr-2 w-full animate-fadeIn">
               <DeviceSelectorModal inline isOpen={true} onClose={() => {}} onSelectDevice={(d) => {
                 setDeviceBrand(d.brandName);
                 setDeviceModel(d.modelName);
                 setDeviceModelId(d.deviceModelId);
                 setDeviceType(d.deviceType);
                 setCatalogMatch(d.catalogMatch);
                 setStep(2);
               }} />
             </div>
          ) : (
             <UserMessage>
               {deviceBrand} {deviceModel}
             </UserMessage>
          )}

          {step >= 2 && (
             <BotMessage>
                <p>Got it. What's wrong with your {deviceBrand} {deviceModel}?</p>
             </BotMessage>
          )}
          
          {step === 2 && (
             <div className="pl-9 pr-2 w-full animate-fadeIn space-y-3">
                <IssueSelector 
                  selectedIssueIds={selectedIssueIds}
                  onChange={(ids) => setSelectedIssueIds(ids)}
                  otherDescription={otherDescription}
                  onOtherDescriptionChange={setOtherDescription}
                  onIssuesLoaded={(issues) => {
                    const dict: Record<string, string> = {};
                    issues.forEach(i => dict[i.id] = i.name);
                    setIssueDict(dict);
                  }}
                />
                <div className="flex justify-end">
                  <button 
                    disabled={selectedIssueIds.length === 0}
                    onClick={() => setStep(3)}
                    className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Continue
                  </button>
                </div>
             </div>
          )}

          {step > 2 && (
             <UserMessage>
               {selectedIssueIds.map(id => issueDict[id] || id).join(', ')}
               {otherDescription && ` - ${otherDescription}`}
             </UserMessage>
          )}

          {step >= 3 && (
             <BotMessage>
                <p>Could you provide a few more details? You can type, record a voice note, or attach photos below.</p>
             </BotMessage>
          )}

          {step > 3 && (
             <UserMessage>
                {description && <p>{description}</p>}
                {(photos.length > 0 || voiceNoteUrl) && (
                  <div className="mt-2 p-2 bg-emerald-700 rounded-xl flex items-center gap-3">
                    {photos.length > 0 && <span className="flex items-center gap-1 text-xs text-white"><Camera className="w-3.5 h-3.5"/> {photos.length}</span>}
                    {voiceNoteUrl && <span className="flex items-center gap-1 text-xs text-white"><Mic className="w-3.5 h-3.5"/> Voice Note</span>}
                  </div>
                )}
             </UserMessage>
          )}

          {step >= 4 && (
             <BotMessage>
                <p>Almost there. Where should we look for technicians? We need your location to find verified pros nearby.</p>
             </BotMessage>
          )}

          {step === 4 && (
             <div className="pl-9 pr-2 w-full animate-fadeIn space-y-3">
                <div className="bg-white rounded-3xl p-3 border border-slate-200">
                  <LocationSelector location={location} onChange={setLocation} />
                </div>
                
                {submitError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{submitError}</p>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button 
                    disabled={isSubmitting || !location || (!location.address && !location.area)}
                    onClick={handleSubmitRequest}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-2xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4" />}
                    Find Technicians
                  </button>
                </div>
             </div>
          )}

          {step >= 5 && (
             <BotMessage>
                <p>Request submitted! Broadcasting to nearby certified technicians...</p>
             </BotMessage>
          )}
          
          {step === 6 && (
             <div className="pl-9 pr-2 w-full animate-fadeIn">
               <TechnicianRadarHandoff 
                  deviceBrand={deviceBrand}
                  deviceModel={deviceModel}
                  problemSummary={selectedIssueIds.slice(0,2).map(id => issueDict[id]||id).join(', ')}
                  locationSummary={location?.area || location?.city || 'Selected Location'}
                  onViewQuotes={() => {
                    if (createdRequestId) onRequestCreated(createdRequestId);
                    else onCancel();
                  }}
               />
             </div>
          )}

          <div ref={endRef} className="h-4" />
       </div>

       {/* Chat Composer */}
       <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          {step === 3 ? (
             <div className="w-full animate-fadeIn space-y-3">
                <div className="bg-white rounded-3xl p-1">
                  <div className="space-y-3 mb-3 px-1">
                    <PhotoEvidenceUploader photos={photos} onChange={setPhotos} />
                    <VoiceNoteRecorder 
                      voiceNoteUrl={voiceNoteUrl} 
                      voiceNoteDurationSeconds={voiceNoteDuration}
                      onChange={(url, dur) => { setVoiceNoteUrl(url); setVoiceNoteDuration(dur); }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <textarea 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-50 border-none rounded-2xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 min-h-[44px] resize-none"
                    />
                    <button 
                      onClick={() => setStep(4)}
                      className="w-12 h-12 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center shrink-0"
                    >
                      <Send className="w-5 h-5 ml-0.5" />
                    </button>
                  </div>
                </div>
             </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 text-sm text-slate-400 cursor-not-allowed select-none">
                {step === 1 ? 'Select a device above...' : 
                 step === 2 ? 'Select issues above...' : 
                 step === 4 ? 'Confirm location above...' : 
                 step >= 5 ? 'Request submitted' : 'Type a message...'}
              </div>
              <button disabled className="w-12 h-12 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center cursor-not-allowed">
                <Mic className="w-5 h-5" />
              </button>
            </div>
          )}
       </div>
    </div>
  );
};
