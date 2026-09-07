import React from 'react';
import { Smartphone, Wrench, FileText, Camera, Mic, MapPin, Edit2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Review your repair request
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Double-check your information before sending it to local technicians.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-5">
        {/* Device Section */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Device</h4>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{deviceBrand} {deviceModel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('device')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Issues Section */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selected Issues</h4>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedIssueIds.map((id) => (
                  <span key={id} className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg text-xs font-semibold">
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
          </div>
          <button
            type="button"
            onClick={() => onEditSection('issues')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Description & Evidence */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description & Evidence</h4>
              <p className="text-xs text-slate-700 font-medium">
                {description || 'No custom description text provided.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                {photos.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Camera className="w-3 h-3 text-slate-500" /> {photos.length} photo{photos.length > 1 ? 's' : ''}
                  </span>
                )}
                {voiceNoteUrl && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Mic className="w-3 h-3 text-slate-500" /> Voice Note attached
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('evidence')}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Location Section */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repair Location</h4>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
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
            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-rose-50 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-start gap-3 border border-rose-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <p>{submitError}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSubmit}
          className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Submitting Request...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Submit Repair Request</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
