import React from 'react';
import { Camera, Mic } from 'lucide-react';
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
  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Attach Photo & Voice Evidence
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Photos and voice notes help technicians give accurate quotes faster.
        </p>
      </div>

      {/* Photos Evidence Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Photos (Max 3)</span>
          </label>
          <span className="text-[11px] font-medium text-slate-400">
            {photos.length}/3 attached
          </span>
        </div>
        <PhotoEvidenceUploader photos={photos} onChange={onChangePhotos} />
      </div>

      {/* Voice Note Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-blue-600" />
          <span>Voice Note Attachment</span>
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

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md cursor-pointer"
        >
          Continue →
        </button>
      </div>
    </div>
  );
};
