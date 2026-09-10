import React from 'react';
import { Camera, Mic, ArrowRight, CheckCircle2 } from 'lucide-react';
import { PhotoEvidenceUploader } from '../customer/repair-flow/PhotoEvidenceUploader';
import { VoiceNoteRecorder, VoiceNotePlayer } from '../customer/repair-flow/VoiceNoteRecorder';

interface EvidenceStepProps {
  photos: string[];
  onChangePhotos: (photos: string[]) => void;
  voiceNoteUrl?: string;
  voiceNoteDuration?: number;
  onChangeVoiceNote: (url?: string, duration?: number) => void;
  onContinue: () => void;
}

export const EvidenceStep: React.FC<EvidenceStepProps> = ({
  photos,
  onChangePhotos,
  voiceNoteUrl,
  voiceNoteDuration,
  onChangeVoiceNote,
  onContinue,
}) => {
  const hasEvidence = photos.length > 0 || Boolean(voiceNoteUrl);

  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Photos Attachment Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Device Damage Photos</span>
          </label>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {photos.length}/3 photos
          </span>
        </div>
        <PhotoEvidenceUploader photos={photos} onChange={onChangePhotos} maxPhotos={3} />
      </div>

      {/* Voice Note Attachment Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 space-y-3 shadow-2xs">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-emerald-600" />
          <span>Voice Explanation</span>
        </label>
        {voiceNoteUrl ? (
          <VoiceNotePlayer
            url={voiceNoteUrl}
            durationSeconds={voiceNoteDuration}
            onDelete={() => onChangeVoiceNote(undefined, undefined)}
          />
        ) : (
          <VoiceNoteRecorder
            voiceNoteUrl={voiceNoteUrl}
            voiceNoteDurationSeconds={voiceNoteDuration}
            onChange={(url, dur) => onChangeVoiceNote(url, dur)}
          />
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500">
          {hasEvidence ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Evidence attached ({photos.length} photo{photos.length !== 1 ? 's' : ''}{voiceNoteUrl ? ' + voice note' : ''})
            </span>
          ) : (
            'Evidence is optional but highly recommended'
          )}
        </span>

        <div className="flex items-center gap-2">
          {!hasEvidence && (
            <button
              type="button"
              onClick={onContinue}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Skip evidence
            </button>
          )}

          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>{hasEvidence ? 'Continue with Evidence' : 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
