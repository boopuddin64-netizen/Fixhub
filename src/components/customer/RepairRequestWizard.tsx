import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CustomerDevice,
  DeviceType,
  LocationCoordinates,
  RepairIssue,
  RepairRequestDraft,
  RepairRequestAttachment,
} from '../../types';
import { ApiClient } from '../../api/client';
import {
  Smartphone,
  Tablet,
  Check,
  ChevronRight,
  ArrowLeft,
  X,
  Loader2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  MapPin,
  Camera,
  Volume2,
  Sparkles,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { VoiceNoteRecorder } from './repair-flow/VoiceNoteRecorder';
import { PhotoEvidenceUploader } from './repair-flow/PhotoEvidenceUploader';
import { IssueSelector } from './repair-flow/IssueSelector';
import { DeviceSelectorModal } from './repair-flow/DeviceSelectorModal';
import { LocationSelector } from './repair-flow/LocationSelector';
import { TechnicianRadarHandoff } from './repair-flow/TechnicianRadarHandoff';

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
  // Step 1: Device | Step 2: Issue | Step 3: Describe & Evidence | Step 4: Review | Step 5: Location | Step 6: Radar Handoff
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  // Draft Banner State
  const [draftRestored, setDraftRestored] = useState<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Step 1: Device State
  const [deviceBrand, setDeviceBrand] = useState<string>(
    preselectedDevice?.brandName || preselectedBrand || 'Apple'
  );
  const [deviceModel, setDeviceModel] = useState<string>(
    preselectedDevice?.modelName || preselectedModel || 'iPhone 13'
  );
  const [deviceModelId, setDeviceModelId] = useState<string | undefined>(
    preselectedDevice?.deviceModelId
  );
  const [deviceType, setDeviceType] = useState<DeviceType>(
    preselectedDevice?.deviceType || 'PHONE'
  );
  const [catalogMatch, setCatalogMatch] = useState<boolean>(
    preselectedDevice ? preselectedDevice.catalogMatch : true
  );
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState<boolean>(false);

  // Step 2: Issues State
  const [issuesCatalog, setIssuesCatalog] = useState<RepairIssue[]>([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>(
    preselectedIssue ? [preselectedIssue] : ['issue_screen_cracked']
  );
  const [otherDescription, setOtherDescription] = useState<string>('');

  // Step 3: Problem Description & Evidence
  const [description, setDescription] = useState<string>('');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | undefined>(undefined);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);

  // Step 5: Location State (Defaults to Ikeja Computer Village corridor)
  const [location, setLocation] = useState<LocationCoordinates>({
    lat: 6.5964,
    lng: 3.3421,
    address: '14 Allen Avenue, Ikeja',
    area: 'Ikeja',
    city: 'Lagos',
    state: 'Lagos State',
    landmark: 'Near Computer Village',
  });

  // Load Issues Catalog & Check Drafts on Initial Mount
  useEffect(() => {
    // 1. Fetch backend normalized issues catalog
    ApiClient.getIssuesCatalog()
      .then((issues) => {
        if (issues && issues.length > 0) {
          setIssuesCatalog(issues);
        }
      })
      .catch((err) => console.error('Failed to load issues catalog:', err));

    // 2. Fetch active draft if available
    ApiClient.getRepairDraft()
      .then((draft) => {
        if (draft && draft.deviceBrand && draft.deviceModel && !preselectedDevice && !preselectedModel) {
          setDeviceBrand(draft.deviceBrand);
          setDeviceModel(draft.deviceModel);
          if (draft.deviceModelId) setDeviceModelId(draft.deviceModelId);
          if (draft.deviceType) setDeviceType(draft.deviceType);
          if (draft.catalogMatch !== undefined) setCatalogMatch(draft.catalogMatch);
          if (draft.issues && draft.issues.length > 0) setSelectedIssueIds(draft.issues);
          if (draft.otherDescription) setOtherDescription(draft.otherDescription);
          if (draft.description) setDescription(draft.description);
          if (draft.voiceNoteUrl) {
            setVoiceNoteUrl(draft.voiceNoteUrl);
            setVoiceNoteDuration(draft.voiceNoteDurationSeconds);
          }
          if (draft.photos && draft.photos.length > 0) setPhotos(draft.photos.slice(0, 3));
          if (draft.customerLocation) setLocation(draft.customerLocation);
          if (draft.step && draft.step >= 1 && draft.step <= 5) setStep(draft.step);

          setDraftRestored(true);
        }
      })
      .catch(() => {
        // Silent catch for non-blocking draft check
      });
  }, [preselectedDevice, preselectedModel]);

  // Debounced Draft Auto-Save
  const triggerDraftSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;

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
      }).catch((err) => {
        console.warn('Draft auto-save notice:', err);
      });
    }, 1200);
  }, [
    step,
    deviceBrand,
    deviceModel,
    deviceModelId,
    deviceType,
    catalogMatch,
    selectedIssueIds,
    otherDescription,
    description,
    voiceNoteUrl,
    voiceNoteDuration,
    photos,
    location,
  ]);

  useEffect(() => {
    triggerDraftSave();
  }, [triggerDraftSave]);

  const handleStartFresh = async () => {
    try {
      await ApiClient.deleteRepairDraft();
      setDraftRestored(false);
      setStep(1);
      setDeviceBrand('Apple');
      setDeviceModel('iPhone 13');
      setSelectedIssueIds(['issue_screen_cracked']);
      setDescription('');
      setVoiceNoteUrl(undefined);
      setPhotos([]);
      setOtherDescription('');
    } catch (err) {
      console.error('Error clearing draft:', err);
    }
  };

  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds((prev) => {
      if (prev.includes(issueId)) {
        return prev.filter((id) => id !== issueId);
      } else {
        return [...prev, issueId];
      }
    });
  };

  // Convert selected issue IDs to human readable labels
  const getSelectedIssueNames = (): string[] => {
    return selectedIssueIds.map((id) => {
      const found = issuesCatalog.find((i) => i.id === id);
      if (found) return found.name;
      // Fallback formatting for legacy issue strings
      return id
        .replace(/^issue_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    });
  };

  // Final Submission Handler
  const handleSubmitRequest = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Package attachments (Voice note + Photos)
      const attachments: RepairRequestAttachment[] = [];

      if (voiceNoteUrl) {
        attachments.push({
          id: `att_voice_${Date.now()}`,
          type: 'AUDIO',
          url: voiceNoteUrl,
          durationSeconds: voiceNoteDuration || 5,
          createdAt: new Date().toISOString(),
        });
      }

      photos.slice(0, 3).forEach((p, idx) => {
        attachments.push({
          id: `att_photo_${Date.now()}_${idx}`,
          type: 'IMAGE',
          url: p,
          createdAt: new Date().toISOString(),
        });
      });

      const requestPayload = {
        deviceBrand,
        deviceModel,
        deviceModelId,
        deviceType,
        catalogMatch,
        issues: selectedIssueIds,
        otherDescription: otherDescription.trim() || undefined,
        description: description.trim() || (getSelectedIssueNames().join(', ') + ' repair needed'),
        photos: photos.slice(0, 3),
        attachments,
        voiceNoteUrl,
        customerLocation: location,
      };

      const created = await ApiClient.createRepairRequest(requestPayload);

      // Transition to Step 6 (Technician Radar Handoff)
      setCreatedRequestId(created.id);
      setStep(6);
    } catch (err: any) {
      console.error('Failed to create repair request:', err);
      setSubmitError(err.message || 'Could not submit repair request. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles: { [key: number]: { title: string; subtitle: string } } = {
    1: { title: 'My Device', subtitle: 'Which device needs repair?' },
    2: { title: "What's wrong?", subtitle: 'Select everything that describes the problem.' },
    3: { title: 'Describe the problem', subtitle: 'Help the technician understand what happened.' },
    4: { title: 'Review your request', subtitle: 'Check your details before we search for technicians.' },
    5: { title: 'Where are you located?', subtitle: "We'll use your location to find verified technicians near you." },
    6: { title: 'Technician Discovery', subtitle: 'Matching your request with top certified shops nearby.' },
  };

  return (
    <div id="repair-request-wizard-container" className="space-y-4">
      {/* Top Header & Breadcrumb Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && step < 6 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Go back to previous step"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {step === 6 ? 'Broadcast Complete' : `Step ${step} of 5`}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                {stepTitles[step]?.title || 'Repair Request'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cancel and close wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {stepTitles[step]?.subtitle}
        </p>

        {/* Step Progress Bar */}
        {step < 6 && (
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s < step
                    ? 'bg-emerald-600'
                    : s === step
                    ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        )}

        {/* Draft Restored Banner */}
        {draftRestored && step < 6 && (
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>We restored your saved repair draft.</span>
            </div>
            <button
              type="button"
              onClick={handleStartFresh}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-950 underline shrink-0 cursor-pointer"
            >
              Start fresh
            </button>
          </div>
        )}
      </div>

      {/* Main Step Body Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
        {/* ================= STEP 1: MY DEVICE ================= */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Selected Device Presentation Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-cyan-300 border border-white/10">
                    {deviceType === 'TABLET' ? (
                      <Tablet className="w-6 h-6" />
                    ) : (
                      <Smartphone className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        {deviceBrand}
                      </span>
                      {catalogMatch && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                          <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                          Verified Model
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {deviceBrand} {deviceModel}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors cursor-pointer"
                >
                  Change device
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300 pt-1 border-t border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fix Hub certified repairers in Lagos have genuine parts ready for this device.</span>
              </div>
            </div>

            {/* Quick Change / Browse Button if needed */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span>Not the device you want to fix?</span>
              <button
                type="button"
                onClick={() => setIsDeviceModalOpen(true)}
                className="font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                Choose another phone or tablet →
              </button>
            </div>

            {/* Step 1 CTA */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Continue: What&apos;s wrong?</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: WHAT'S WRONG? ================= */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <IssueSelector
              issues={issuesCatalog}
              selectedIssueIds={selectedIssueIds}
              onToggleIssue={toggleIssue}
              otherDescription={otherDescription}
              onOtherDescriptionChange={setOtherDescription}
            />

            {/* Step 2 CTA */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={selectedIssueIds.length === 0}
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Continue: Describe problem</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: DESCRIBE THE PROBLEM & EVIDENCE ================= */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            {/* WhatsApp-Style Conversational Inbound Prompt */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                FH
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-xs p-3.5 text-xs sm:text-sm text-emerald-950 max-w-lg space-y-1">
                <p className="font-bold">What happened to your device?</p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  You can type what happened in your own words, record a quick voice note, or attach photos of the damage.
                </p>
              </div>
            </div>

            {/* Outbound Description Composer Bubble */}
            <div className="space-y-2 pl-2 sm:pl-10">
              <label className="text-xs font-bold text-slate-700">Your notes for the technician</label>
              <textarea
                rows={3}
                placeholder="e.g., The phone slipped while getting out of a cab. Screen shattered and touch is partially unresponsive..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-xs"
              />
            </div>

            {/* Voice Note Recording Section */}
            <div className="pl-2 sm:pl-10">
              <VoiceNoteRecorder
                voiceNoteUrl={voiceNoteUrl}
                voiceNoteDurationSeconds={voiceNoteDuration}
                onChange={(url, duration) => {
                  setVoiceNoteUrl(url);
                  setVoiceNoteDuration(duration);
                }}
              />
            </div>

            {/* Photo Evidence Section (Max 3, Client-side compressed) */}
            <div className="pl-2 sm:pl-10 border-t border-slate-100 pt-4">
              <PhotoEvidenceUploader
                photos={photos}
                onChange={setPhotos}
                maxPhotos={3}
              />
            </div>

            {/* Step 3 CTA */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Continue: Review request</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: REVIEW REQUEST ================= */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Review Sections Breakdown */}
            <div className="space-y-3">
              {/* 1. Device Review */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device</span>
                    <p className="text-sm font-black text-slate-900">{deviceBrand} {deviceModel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* 2. Problems Review */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Selected Problems ({selectedIssueIds.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {getSelectedIssueNames().map((name, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  {otherDescription && (
                    <p className="text-xs text-slate-600 italic mt-1">
                      &ldquo;{otherDescription}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 underline shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* 3. Notes & Evidence Review */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Description & Attachments
                  </span>
                  {description ? (
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No additional notes written</p>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    {voiceNoteUrl && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Volume2 className="w-3.5 h-3.5" />
                        Voice note ({voiceNoteDuration || 5}s)
                      </span>
                    )}
                    {photos.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <Camera className="w-3.5 h-3.5" />
                        {photos.length} photo{photos.length === 1 ? '' : 's'} attached
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 underline shrink-0 cursor-pointer"
                >
                  Edit
                </button>
              </div>

              {/* 4. Location Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Location</span>
                    <p className="text-xs font-bold text-slate-900">{location.address || `${location.area}, ${location.city}`}</p>
                    <p className="text-[11px] text-slate-500">{location.city}, {location.state}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Escrow Guarantee Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-950">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>100% Escrow Protection:</strong> Submitting this request is completely free. When you choose a quote, your payment is held securely in escrow until you verify the repair is complete.
              </span>
            </div>

            {/* Step 4 CTA */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Continue to Location</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: LOCATION SELECTION ================= */}
        {step === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <LocationSelector
              location={location}
              onChange={setLocation}
            />

            {submitError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Step 5 CTA -> Submit Request */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isSubmitting}
                className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                id="submit-repair-request-btn"
                onClick={handleSubmitRequest}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Broadcasting to Technicians...</span>
                  </>
                ) : (
                  <>
                    <span>Find Technicians</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 6: TECHNICIAN RADAR DISCOVERY ================= */}
        {step === 6 && (
          <TechnicianRadarHandoff
            deviceBrand={deviceBrand}
            deviceModel={deviceModel}
            problemSummary={getSelectedIssueNames().slice(0, 2).join(', ')}
            locationSummary={location.area || location.city}
            onViewQuotes={() => {
              if (createdRequestId) {
                onRequestCreated(createdRequestId);
              } else {
                onCancel();
              }
            }}
          />
        )}
      </div>

      {/* Device Selection Modal for Step 1 "Change Device" */}
      <DeviceSelectorModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        currentBrand={deviceBrand}
        currentModel={deviceModel}
        onSelectDevice={(data) => {
          setDeviceBrand(data.brandName);
          setDeviceModel(data.modelName);
          setDeviceModelId(data.deviceModelId);
          setDeviceType(data.deviceType);
          setCatalogMatch(data.catalogMatch);
        }}
      />
    </div>
  );
};
