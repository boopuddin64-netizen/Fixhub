import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, X, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { DeviceType, LocationCoordinates, RepairIssue } from '../../types';
import { RepairMessage } from './RepairMessage';
import { DeviceStep } from './DeviceStep';
import { IssueStep } from './IssueStep';
import { DescriptionStep } from './DescriptionStep';
import { EvidenceStep } from './EvidenceStep';
import { LocationStep } from './LocationStep';
import { RepairReview } from './RepairReview';
import { RepairSubmitting } from './RepairSubmitting';
import { RepairSuccess } from './RepairSuccess';
import { ChatComposer } from './ChatComposer';
import { DeviceSelectorModal } from '../customer/repair-flow/DeviceSelectorModal';

export type RepairStage =
  | 'device'
  | 'issues'
  | 'description'
  | 'evidence'
  | 'location'
  | 'review'
  | 'submitting'
  | 'submitted';

interface RepairConversationProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
  preselectedDevice?: string;
  preselectedBrand?: string;
  preselectedModel?: string;
  preselectedIssue?: string;
}

export const RepairConversation: React.FC<RepairConversationProps> = ({
  onCancel,
  onRequestCreated,
  preselectedDevice,
  preselectedBrand,
  preselectedModel,
  preselectedIssue,
}) => {
  const [stage, setStage] = useState<RepairStage>('device');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Device state
  const [deviceBrand, setDeviceBrand] = useState<string>(preselectedBrand || '');
  const [deviceModel, setDeviceModel] = useState<string>(preselectedModel || '');
  const [deviceModelId, setDeviceModelId] = useState<string | undefined>();
  const [deviceType, setDeviceType] = useState<DeviceType>('PHONE');
  const [catalogMatch, setCatalogMatch] = useState(false);

  // Issues state
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>(
    preselectedIssue ? [preselectedIssue] : []
  );
  const [otherDescription, setOtherDescription] = useState<string>('');
  const [issueDict, setIssueDict] = useState<Record<string, string>>({});

  // Description & Evidence
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | undefined>();
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number | undefined>();

  // Location
  const [location, setLocation] = useState<LocationCoordinates | null>(null);

  // Highest stage reached to support seamless jumping back to review after editing
  const [hasVisitedReview, setHasVisitedReview] = useState(false);

  // Async & submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Load draft on mount
  useEffect(() => {
    ApiClient.getRepairDraft()
      .then((draft) => {
        if (draft && draft.deviceBrand && draft.deviceModel && !preselectedDevice && !preselectedModel) {
          if (draft.step) {
            const stages: RepairStage[] = [
              'device',
              'issues',
              'description',
              'evidence',
              'location',
              'review',
              'submitting',
              'submitted',
            ];
            const loadedStage = stages[draft.step - 1];
            if (loadedStage && loadedStage !== 'submitted' && loadedStage !== 'submitting') {
              setStage(loadedStage);
              if (loadedStage === 'review') setHasVisitedReview(true);
            }
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

  // Debounced draft saving
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      if (stage === 'submitted' || stage === 'submitting') {
        return;
      }
      if (
        !deviceBrand &&
        !deviceModel &&
        selectedIssueIds.length === 0 &&
        !description &&
        !voiceNoteUrl &&
        photos.length === 0 &&
        !location
      ) {
        return;
      }
      const stages: RepairStage[] = [
        'device',
        'issues',
        'description',
        'evidence',
        'location',
        'review',
        'submitting',
        'submitted',
      ];
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
  }, [
    stage,
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

  // Keep track of visited review stage
  useEffect(() => {
    if (stage === 'review') {
      setHasVisitedReview(true);
    }
  }, [stage]);

  // Auto-scroll on stage changes or content updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeStepRef.current) {
        activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [stage, selectedIssueIds.length, photos.length, Boolean(voiceNoteUrl), Boolean(location)]);

  const handleSubmitRequest = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    setStage('submitting');
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
      // Clean up server-side draft after successful submission
      ApiClient.deleteRepairDraft().catch(() => {});
    } catch (err: any) {
      console.error('Failed to create repair request:', err);
      setSubmitError(
        err.message || 'Could not submit repair request. Please check your connection and retry.'
      );
      setStage('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    switch (stage) {
      case 'issues':
        setStage('device');
        break;
      case 'description':
        setStage('issues');
        break;
      case 'evidence':
        setStage('description');
        break;
      case 'location':
        setStage('evidence');
        break;
      case 'review':
        setStage('location');
        break;
      default:
        onCancel();
        break;
    }
  };

  // Support swipe-right gesture navigation across stages
  useEffect(() => {
    const handleGestureBack = (e: Event) => {
      if (stage !== 'device' && stage !== 'submitted' && stage !== 'submitting') {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('fixhub:navigate-back', handleGestureBack);
    return () => window.removeEventListener('fixhub:navigate-back', handleGestureBack);
  }, [stage, handleBack]);

  const stages: RepairStage[] = [
    'device',
    'issues',
    'description',
    'evidence',
    'location',
    'review',
    'submitting',
    'submitted',
  ];

  const currentStageIndex = stages.indexOf(stage);

  const isStagePast = (checkStage: RepairStage): boolean => {
    return currentStageIndex > stages.indexOf(checkStage);
  };

  const selectedIssuesBadges = useMemo(() => {
    const list = selectedIssueIds.map((id) => issueDict[id] || id);
    if (otherDescription) list.push(otherDescription);
    return list;
  }, [selectedIssueIds, issueDict, otherDescription]);

  // Advance to next stage from bottom composer or inline continue
  const advanceToNextStage = () => {
    switch (stage) {
      case 'device':
        if (deviceBrand && deviceModel) setStage('issues');
        break;
      case 'issues':
        if (selectedIssueIds.length > 0) setStage('description');
        break;
      case 'description':
        setStage('evidence');
        break;
      case 'evidence':
        setStage('location');
        break;
      case 'location':
        if (location) setStage('review');
        break;
      case 'review':
        handleSubmitRequest();
        break;
    }
  };

  return (
    <div className="flex flex-col h-[88vh] max-h-[860px] bg-slate-50/90 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200/90">
      {/* Top Header */}
      <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          {stage !== 'device' && stage !== 'submitted' ? (
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Go back one step"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center border border-slate-800 shadow-xs">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  Fixhub Repair Assistant
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Verified Assistant" />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {stage === 'review'
                  ? 'Review your repair request'
                  : stage === 'submitting'
                  ? 'Submitting request...'
                  : stage === 'submitted'
                  ? 'Request confirmed'
                  : 'Repair request intake'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Cancel request"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progressive Continuous Chat Scroll Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5"
        style={{ paddingBottom: '7rem' }}
      >
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
          {/* ========================================================= */}
          {/* QUESTION 1: DEVICE                                        */}
          {/* ========================================================= */}
          <RepairMessage
            sender="assistant"
            summaryText="Hello! Welcome to Fixhub. Which device needs repair today?"
          />

          {/* If actively editing or on device step */}
          {stage === 'device' && (
            <div ref={activeStepRef} className="ml-11 max-w-[95%]">
              <DeviceStep
                currentBrand={deviceBrand}
                currentModel={deviceModel}
                currentDeviceType={deviceType}
                onSelectDevice={(d) => {
                  setDeviceBrand(d.brandName);
                  setDeviceModel(d.modelName);
                  setDeviceModelId(d.deviceModelId);
                  setDeviceType(d.deviceType);
                  setCatalogMatch(d.catalogMatch);
                }}
                onContinue={() => setStage('issues')}
              />
            </div>
          )}

          {/* Once device is selected and user is past or editing elsewhere */}
          {stage !== 'device' && deviceBrand && deviceModel && (
            <RepairMessage
              sender="customer"
              title="Device"
              subtitle={deviceType}
              type="device"
              summaryText={`${deviceBrand} ${deviceModel}`}
              onEdit={() => setStage('device')}
            />
          )}

          {/* ========================================================= */}
          {/* QUESTION 2: ISSUES                                        */}
          {/* (Visible once device has been chosen or stage is issues+) */}
          {/* ========================================================= */}
          {(stage === 'issues' || isStagePast('device') || (deviceBrand && deviceModel && stage !== 'device')) && (
            <>
              <RepairMessage
                sender="assistant"
                summaryText={`Got it, ${deviceBrand} ${deviceModel}. What seems to be wrong with it?`}
              />

              {stage === 'issues' && (
                <div ref={activeStepRef} className="ml-11 max-w-[95%]">
                  <IssueStep
                    deviceBrand={deviceBrand}
                    deviceModel={deviceModel}
                    selectedIssueIds={selectedIssueIds}
                    otherDescription={otherDescription}
                    onChangeSelectedIssues={setSelectedIssueIds}
                    onChangeOtherDescription={setOtherDescription}
                    onIssuesLoaded={(issues) => {
                      const dict: Record<string, string> = {};
                      issues.forEach((i) => (dict[i.id] = i.name));
                      setIssueDict(dict);
                    }}
                    onContinue={() => setStage('description')}
                  />
                </div>
              )}

              {stage !== 'issues' && selectedIssueIds.length > 0 && (
                <RepairMessage
                  sender="customer"
                  title="Problem"
                  type="issues"
                  summaryText={`${selectedIssueIds.length} problem${selectedIssueIds.length > 1 ? 's' : ''} reported`}
                  badges={selectedIssuesBadges}
                  onEdit={() => setStage('issues')}
                />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* QUESTION 3: DESCRIPTION                                   */}
          {/* (Visible once issues have been chosen or stage is desc+)   */}
          {/* ========================================================= */}
          {(stage === 'description' || isStagePast('issues')) && (
            <>
              <RepairMessage
                sender="assistant"
                summaryText="Anything else happening? Provide any extra details about how the damage occurred or what is happening."
              />

              {stage === 'description' && (
                <div ref={activeStepRef} className="ml-11 max-w-[95%]">
                  <DescriptionStep
                    description={description}
                    onChangeDescription={setDescription}
                    onContinue={() => setStage('evidence')}
                  />
                </div>
              )}

              {stage !== 'description' && isStagePast('issues') && (
                <RepairMessage
                  sender="customer"
                  title="Description"
                  type="description"
                  summaryText={
                    description.trim() ||
                    (otherDescription ? `Other: ${otherDescription}` : 'No additional description reported')
                  }
                  onEdit={() => setStage('description')}
                />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* QUESTION 4: EVIDENCE                                      */}
          {/* (Visible once description has been answered or stage+)     */}
          {/* ========================================================= */}
          {(stage === 'evidence' || isStagePast('description')) && (
            <>
              <RepairMessage
                sender="assistant"
                summaryText="Can you show or explain the damage? Clear photos and voice notes help technicians diagnose the issue and give exact quotes faster."
              />

              {stage === 'evidence' && (
                <div ref={activeStepRef} className="ml-11 max-w-[95%]">
                  <EvidenceStep
                    photos={photos}
                    onChangePhotos={setPhotos}
                    voiceNoteUrl={voiceNoteUrl}
                    voiceNoteDuration={voiceNoteDuration}
                    onChangeVoiceNote={(url, dur) => {
                      setVoiceNoteUrl(url);
                      setVoiceNoteDuration(dur);
                    }}
                    onContinue={() => setStage('location')}
                  />
                </div>
              )}

              {stage !== 'evidence' && isStagePast('description') && (
                <RepairMessage
                  sender="customer"
                  title="Photos & Voice Note"
                  type="evidence"
                  summaryText={
                    photos.length > 0 || voiceNoteUrl
                      ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}${voiceNoteUrl ? ' • 1 Voice Note' : ''}`
                      : 'No photos or voice note attached'
                  }
                  photos={photos}
                  voiceNoteUrl={voiceNoteUrl}
                  voiceNoteDuration={voiceNoteDuration}
                  onEdit={() => setStage('evidence')}
                />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* QUESTION 5: LOCATION                                      */}
          {/* (Visible once evidence has been answered or stage+)       */}
          {/* ========================================================= */}
          {(stage === 'location' || isStagePast('evidence')) && (
            <>
              <RepairMessage
                sender="assistant"
                summaryText="Where will you take the device for repair? We'll match you with verified repair shops closest to you."
              />

              {stage === 'location' && (
                <div ref={activeStepRef} className="ml-11 max-w-[95%]">
                  <LocationStep
                    location={location}
                    onChangeLocation={setLocation}
                    onContinue={() => setStage('review')}
                  />
                </div>
              )}

              {stage !== 'location' && location && isStagePast('evidence') && (
                <RepairMessage
                  sender="customer"
                  title="Your Location"
                  type="location"
                  summaryText={location.address || location.area || location.city || 'Location confirmed'}
                  locationDetails={{
                    address: location.address,
                    area: location.area,
                    city: location.city,
                    state: location.state,
                  }}
                  onEdit={() => setStage('location')}
                />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* QUESTION 6: REVIEW & SUMMARY                              */}
          {/* ========================================================= */}
          {stage === 'review' && (
            <div ref={activeStepRef}>
              <RepairMessage
                sender="assistant"
                summaryText="Here is your complete repair request summary. Review every detail before we notify verified local repair shops."
              >
                <div className="mt-3">
                  <RepairReview
                    deviceBrand={deviceBrand}
                    deviceModel={deviceModel}
                    selectedIssueIds={selectedIssueIds}
                    issueDict={issueDict}
                    otherDescription={otherDescription}
                    description={description}
                    photos={photos}
                    voiceNoteUrl={voiceNoteUrl}
                    location={location}
                    submitError={submitError}
                    isSubmitting={isSubmitting}
                    onEditSection={(sec) => setStage(sec)}
                    onSubmit={handleSubmitRequest}
                  />
                </div>
              </RepairMessage>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBMITTING STATE                                          */}
          {/* ========================================================= */}
          {stage === 'submitting' && (
            <div ref={activeStepRef}>
              <RepairMessage
                sender="assistant"
                summaryText="Connecting to Fixhub repair network..."
              >
                <div className="mt-2">
                  <RepairSubmitting />
                </div>
              </RepairMessage>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBMITTED SUCCESS STATE                                   */}
          {/* ========================================================= */}
          {stage === 'submitted' && createdRequestId && (
            <div ref={activeStepRef}>
              <RepairMessage
                sender="assistant"
                summaryText="Your repair request is live! Technicians in your area have been notified."
              >
                <div className="mt-3">
                  <RepairSuccess
                    requestId={createdRequestId}
                    deviceBrand={deviceBrand}
                    deviceModel={deviceModel}
                    onFindTechnicians={() => onRequestCreated(createdRequestId)}
                  />
                </div>
              </RepairMessage>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* FIXED BOTTOM COMPOSER                                     */}
      {/* ========================================================= */}
      {stage !== 'submitting' && stage !== 'submitted' && (
        <ChatComposer
          stage={stage}
          deviceBrand={deviceBrand}
          deviceModel={deviceModel}
          selectedIssueIds={selectedIssueIds}
          description={description}
          onChangeDescription={setDescription}
          onSendDescription={() => setStage('evidence')}
          photos={photos}
          voiceNoteUrl={voiceNoteUrl}
          location={location}
          isSubmitting={isSubmitting}
          onAdvanceStage={advanceToNextStage}
          onSubmit={handleSubmitRequest}
          onOpenCatalog={() => setIsCatalogModalOpen(true)}
          createdRequestId={createdRequestId || undefined}
          onFindTechnicians={createdRequestId ? () => onRequestCreated(createdRequestId) : undefined}
        />
      )}

      {/* Device Catalog Modal */}
      {isCatalogModalOpen && (
        <DeviceSelectorModal
          isOpen={isCatalogModalOpen}
          onClose={() => setIsCatalogModalOpen(false)}
          currentBrand={deviceBrand}
          currentModel={deviceModel}
          onSelectDevice={(d) => {
            setDeviceBrand(d.brandName);
            setDeviceModel(d.modelName);
            setDeviceModelId(d.deviceModelId);
            setDeviceType(d.deviceType);
            setCatalogMatch(d.catalogMatch);
            setIsCatalogModalOpen(false);
            setStage('issues');
          }}
        />
      )}
    </div>
  );
};
