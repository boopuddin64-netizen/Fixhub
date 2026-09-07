import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
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

  // Async & submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (!deviceBrand && !deviceModel && selectedIssueIds.length === 0 && !description && !voiceNoteUrl && photos.length === 0 && !location) {
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [stage]);

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

  const isStagePast = (checkStage: RepairStage): boolean => {
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
    return stages.indexOf(stage) > stages.indexOf(checkStage);
  };

  const selectedIssuesBadges = selectedIssueIds.map((id) => issueDict[id] || id);
  if (otherDescription) selectedIssuesBadges.push(otherDescription);

  return (
    <div className="flex flex-col h-[85vh] max-h-[820px] bg-slate-50/80 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200/80">
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          {stage !== 'device' && stage !== 'submitted' ? (
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Request Phone Repair</h2>
            <p className="text-[11px] text-slate-500 hidden sm:block">Fix Hub Guided Service Request</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Conversation & Step Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28" ref={scrollRef}>
        <div className="max-w-lg mx-auto space-y-4">
          {/* Progressive Completed Answer Thread */}
          {stage !== 'review' && isStagePast('device') && deviceBrand && deviceModel && (
            <RepairMessage
              title="Selected Device"
              summaryText={`${deviceBrand} ${deviceModel}`}
              onEdit={() => setStage('device')}
            />
          )}

          {stage !== 'review' && isStagePast('issues') && selectedIssueIds.length > 0 && (
            <RepairMessage
              title="Reported Problems"
              summaryText={`${selectedIssueIds.length} issue${selectedIssueIds.length > 1 ? 's' : ''} selected`}
              badges={selectedIssuesBadges}
              onEdit={() => setStage('issues')}
            />
          )}

          {stage !== 'review' && isStagePast('description') && (description || otherDescription) && (
            <RepairMessage
              title="Problem Description"
              summaryText={description || otherDescription || 'Details added'}
              onEdit={() => setStage('description')}
            />
          )}

          {stage !== 'review' && isStagePast('evidence') && (photos.length > 0 || voiceNoteUrl) && (
            <RepairMessage
              title="Evidence Attached"
              summaryText={`${photos.length} photo${photos.length !== 1 ? 's' : ''}${voiceNoteUrl ? ' • 1 Voice Note' : ''}`}
              onEdit={() => setStage('evidence')}
            />
          )}

          {stage !== 'review' && isStagePast('location') && location && (
            <RepairMessage
              title="Repair Location"
              summaryText={location.address || location.area || location.city || 'Location confirmed'}
              onEdit={() => setStage('location')}
            />
          )}

          {/* Active Step Cards */}
          {stage === 'device' && (
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
          )}

          {stage === 'issues' && (
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
          )}

          {stage === 'description' && (
            <DescriptionStep
              description={description}
              onChangeDescription={setDescription}
              onContinue={() => setStage('evidence')}
            />
          )}

          {stage === 'evidence' && (
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
          )}

          {stage === 'location' && (
            <LocationStep
              location={location}
              onChangeLocation={setLocation}
              onContinue={() => setStage('review')}
            />
          )}

          {stage === 'review' && (
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
          )}

          {stage === 'submitting' && <RepairSubmitting />}

          {stage === 'submitted' && createdRequestId && (
            <RepairSuccess
              requestId={createdRequestId}
              deviceBrand={deviceBrand}
              deviceModel={deviceModel}
              onFindTechnicians={() => onRequestCreated(createdRequestId)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
