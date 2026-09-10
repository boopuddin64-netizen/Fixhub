import React from 'react';
import { Smartphone, Wrench, FileText, Camera, Volume2, MapPin, Edit2, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { LocationCoordinates } from '../../types';

interface RepairReviewProps {
  deviceBrand: string;
  deviceModel: string;
  selectedIssueIds: string[];
  issueDict: Record<string, string>;
  otherDescription?: string;
  description?: string;
  photos: string[];
  voiceNoteUrl?: string;
  location: LocationCoordinates | null;
  submitError?: string | null;
  isSubmitting: boolean;
  onEditSection: (section: 'device' | 'issues' | 'description' | 'evidence' | 'location') => void;
  onSubmit: () => void;
}

export const RepairReview: React.FC<RepairReviewProps> = ({
  deviceBrand,
  deviceModel,
  selectedIssueIds,
  issueDict,
  otherDescription,
  description,
  photos,
  voiceNoteUrl,
  location,
  submitError,
  isSubmitting,
  onEditSection,
  onSubmit,
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        {/* Device Section */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">{deviceBrand} {deviceModel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('device')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Issues Section */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Problem</span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedIssueIds.map((id) => (
                  <span key={id} className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-md text-[11px] font-semibold">
                    {issueDict[id] || id}
                  </span>
                ))}
                {otherDescription && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium">
                    {otherDescription}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('issues')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Description Section */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
              <p className="text-xs text-slate-700 font-medium break-words leading-relaxed">
                {description || 'No additional description provided.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('description')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Evidence Section */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Photos & Voice Note</span>
              {photos.length === 0 && !voiceNoteUrl ? (
                <p className="text-xs text-slate-500 italic">No photos or voice note attached.</p>
              ) : (
                <div className="space-y-2">
                  {photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      {photos.map((url, idx) => (
                        <div key={idx} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                          <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  )}
                  {voiceNoteUrl && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-medium">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Voice Note Attached</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('evidence')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Location Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Location</span>
              <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                {location?.address || location?.area || location?.city || 'Location Selected'}
              </p>
              {location?.city && location?.state && (
                <p className="text-[11px] text-slate-500">{location.city}, {location.state}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('location')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="p-3.5 bg-rose-50 text-rose-800 text-xs rounded-2xl flex items-start gap-2.5 border border-rose-200 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <p className="leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Primary Submit CTA inside review */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Fixhub Escrow Protected • Verified Technicians Only</span>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSubmit}
          className="w-full sm:w-auto px-7 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending Repair Request...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Send Repair Request</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
