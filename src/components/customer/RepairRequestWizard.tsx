import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, Send, AlertCircle, Loader2, Search, CheckCircle2, MapPin, Smartphone, PenTool, ArrowLeft } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { DeviceType } from '../../types';
import { DeviceSelectorModal } from './repair-flow/DeviceSelectorModal';
import { IssueSelector } from './repair-flow/IssueSelector';
import { LocationSelector } from './repair-flow/LocationSelector';
import { PhotoEvidenceUploader } from './repair-flow/PhotoEvidenceUploader';
import { VoiceNoteRecorder } from './repair-flow/VoiceNoteRecorder';

interface RepairRequestWizardProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
  preselectedDevice?: string;
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
  type RepairStage = 'device' | 'issues' | 'evidence' | 'location' | 'review' | 'submitted';
  const [stage, setStage] = useState<RepairStage>('device');

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

  const [issueDict, setIssueDict] = useState<Record<string, string>>({});
  const saveTimeoutRef = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Draft loading
  useEffect(() => {
    ApiClient.getRepairDraft()
      .then((draft) => {
        if (draft && draft.deviceBrand && draft.deviceModel && !preselectedDevice && !preselectedModel) {
          if (draft.step) {
            const stages: RepairStage[] = ['device', 'issues', 'evidence', 'location', 'review', 'submitted'];
            setStage(stages[draft.step - 1] || 'device');
          }
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
                  // Do NOT auto-advance the stage. Allow the user to see and click continue.
                }
              }
            })
            .catch(() => {});
        }

        if (!location) {
          ApiClient.getMe()
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

  // Debounced Draft Saving
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      if (stage === 'submitted') {
        return;
      }
      if (!deviceBrand && !deviceModel && selectedIssueIds.length === 0 && !description && !voiceNoteUrl && photos.length === 0 && !location) {
        return;
      }
      const stages: RepairStage[] = ['device', 'issues', 'evidence', 'location', 'review', 'submitted'];
      const numericStep = stages.indexOf(stage) + 1;
      
      ApiClient.saveRepairDraft({
        step: numericStep,
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
  }, [stage, deviceBrand, deviceModel, deviceModelId, deviceType, catalogMatch, selectedIssueIds, otherDescription, description, voiceNoteUrl, voiceNoteDuration, photos, location]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stage]);

  const handleSubmitRequest = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
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
      setStage('submitted');
      // DO NOT automatically jump to technician radar. Wait for user to click Find Technicians.
    } catch (err: any) {
      console.error('Failed to create repair request:', err);
      setSubmitError(err.message || 'Could not submit repair request. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    switch (stage) {
      case 'issues': setStage('device'); break;
      case 'evidence': setStage('issues'); break;
      case 'location': setStage('evidence'); break;
      case 'review': setStage('location'); break;
      default: onCancel(); break;
    }
  };

  return (
    <div className="flex flex-col h-[85vh] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200" ref={topRef}>
       {/* Header */}
       <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             {stage !== 'device' && stage !== 'submitted' ? (
               <button type="button" onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                 <ArrowLeft className="w-5 h-5 text-slate-700" />
               </button>
             ) : (
               <button type="button" onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                 <ArrowLeft className="w-5 h-5 text-slate-700" />
               </button>
             )}
             <h2 className="text-lg font-bold text-slate-900">Request Repair</h2>
          </div>
       </div>

       {/* Content Area */}
       <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32">
          
          {stage === 'device' && (
            <div className="space-y-4 max-w-lg mx-auto animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-900">What device needs repair?</h3>
              <p className="text-sm text-slate-500">Select the device you need fixed.</p>
              
              <DeviceSelectorModal inline isOpen={true} onClose={() => {}} currentBrand={deviceBrand} currentModel={deviceModel} onSelectDevice={(d) => {
                setDeviceBrand(d.brandName);
                setDeviceModel(d.modelName);
                setDeviceModelId(d.deviceModelId);
                setDeviceType(d.deviceType);
                setCatalogMatch(d.catalogMatch);
              }} />

              <div className="flex justify-end pt-4">
                <button type="button" 
                  disabled={!deviceBrand || !deviceModel}
                  onClick={() => setStage('issues')}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {stage === 'issues' && (
            <div className="space-y-4 max-w-lg mx-auto animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-900">What's wrong with your {deviceBrand} {deviceModel}?</h3>
              <p className="text-sm text-slate-500">Select all that apply.</p>
              
              <IssueSelector 
                selectedIssueIds={selectedIssueIds}
                onChange={setSelectedIssueIds}
                otherDescription={otherDescription}
                onOtherDescriptionChange={setOtherDescription}
                onIssuesLoaded={(issues) => {
                  const dict: Record<string, string> = {};
                  issues.forEach(i => dict[i.id] = i.name);
                  setIssueDict(dict);
                }}
              />
              <div className="flex justify-end pt-4">
                <button type="button" 
                  disabled={selectedIssueIds.length === 0}
                  onClick={() => setStage('evidence')}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {stage === 'evidence' && (
            <div className="space-y-4 max-w-lg mx-auto animate-fadeIn flex flex-col min-h-full">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Tell us what happened</h3>
                <p className="text-sm text-slate-500">Add photos, a voice note, or describe the issue below.</p>
              </div>
              
              {/* Added evidence preview area to show what's collected so far before sending */}
              <div className="flex-1 space-y-4 mt-6">
                {description && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{description}</p>
                  </div>
                )}
                
                {photos.length > 0 && (
                   <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Photos ({photos.length}/3)</h4>
                      <div className="flex gap-2 flex-wrap">
                        {photos.map((p, idx) => (
                           <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                             <img src={p} alt="Evidence" className="w-full h-full object-cover" />
                           </div>
                        ))}
                      </div>
                   </div>
                )}

                {voiceNoteUrl && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voice Note</h4>
                     <audio src={voiceNoteUrl} controls className="w-full h-10" />
                  </div>
                )}

                {(!description && photos.length === 0 && !voiceNoteUrl) && (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    Use the controls below to add details.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 pb-20">
                <button type="button" 
                  onClick={() => setStage('location')}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {stage === 'location' && (
            <div className="space-y-4 max-w-lg mx-auto animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-900">Where should we find technicians?</h3>
              <p className="text-sm text-slate-500">Provide a location so we can match you with nearby pros.</p>
              
              <div className="bg-white rounded-3xl p-4 border border-slate-200">
                <LocationSelector location={location} onChange={setLocation} />
              </div>
              
              <div className="flex justify-end pt-4">
                <button type="button" 
                  disabled={!location || (!location.address && !location.area)}
                  onClick={() => setStage('review')}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  Review Request
                </button>
              </div>
            </div>
          )}

          {stage === 'review' && (
            <div className="space-y-4 max-w-lg mx-auto animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-900">Review your request</h3>
              
              <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-6">
                
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Device</h4>
                  <p className="text-sm font-medium text-slate-900">{deviceBrand} {deviceModel}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Problem</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIssueIds.map(id => (
                      <span key={id} className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                        {issueDict[id] || id}
                      </span>
                    ))}
                    {otherDescription && (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        {otherDescription}
                      </span>
                    )}
                  </div>
                </div>

                {(description || photos.length > 0 || voiceNoteUrl) && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence</h4>
                    {description && <p className="text-sm text-slate-700 mb-2">{description}</p>}
                    <div className="flex items-center gap-3">
                      {photos.length > 0 && <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1"><Camera className="w-3.5 h-3.5"/> {photos.length} photos</span>}
                      {voiceNoteUrl && <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1"><Mic className="w-3.5 h-3.5"/> 1 voice note</span>}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Location</h4>
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    {location?.address || location?.area || location?.city || 'Selected Location'}
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl flex items-start gap-3 border border-red-100">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{submitError}</p>
                </div>
              )}
              
              <div className="flex justify-end pt-4 gap-3">
                <button type="button" 
                  onClick={() => setStage('device')}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Edit
                </button>
                <button type="button" 
                  disabled={isSubmitting}
                  onClick={handleSubmitRequest}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5" />}
                  Submit Repair Request
                </button>
              </div>
            </div>
          )}

          {stage === 'submitted' && (
            <div className="space-y-6 max-w-lg mx-auto animate-fadeIn text-center pt-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900">Repair request submitted</h3>
              <p className="text-slate-500">Your request has been saved successfully.</p>
              
              <div className="pt-8 flex justify-center">
                <button type="button" 
                  onClick={() => {
                    if (createdRequestId) onRequestCreated(createdRequestId);
                    else onCancel();
                  }}
                  className="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
                >
                  <Search className="w-5 h-5" />
                  Find Technicians
                </button>
              </div>
            </div>
          )}
       </div>

       {/* Composer specifically for Evidence stage - WhatsApp style bottom input */}
       {stage === 'evidence' && (
         <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/80 backdrop-blur-md border-t border-slate-200 shrink-0 z-20">
           <div className="max-w-lg mx-auto flex items-end gap-2">
             <div className="pb-1.5 shrink-0 flex gap-2">
               <PhotoEvidenceUploader photos={photos} onChange={setPhotos} />
             </div>
             
             <div className="flex-1 bg-slate-100 rounded-3xl flex items-end p-1 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all relative">
               <textarea 
                 value={description}
                 onChange={e => setDescription(e.target.value)}
                 placeholder="Describe the problem..."
                 className="flex-1 bg-transparent border-none p-3 text-sm focus:ring-0 min-h-[44px] max-h-[120px] resize-none"
                 rows={1}
               />
               <div className="shrink-0 p-1">
                 <VoiceNoteRecorder 
                   voiceNoteUrl={voiceNoteUrl} 
                   voiceNoteDurationSeconds={voiceNoteDuration}
                   onChange={(url, dur) => { setVoiceNoteUrl(url); setVoiceNoteDuration(dur); }}
                 />
               </div>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};
