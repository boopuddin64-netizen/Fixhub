import React, { useState } from 'react';
import { Send, ArrowRight, Camera, Mic, ShieldCheck, Loader2, Sparkles, Check, CheckCircle2, Smartphone } from 'lucide-react';
import { LocationCoordinates } from '../../types';
import { RepairStage } from './RepairConversation';

interface ChatComposerProps {
  stage: RepairStage;
  deviceBrand: string;
  deviceModel: string;
  selectedIssueIds: string[];
  description: string;
  onChangeDescription: (desc: string) => void;
  onSendDescription: () => void;
  photos: string[];
  voiceNoteUrl?: string;
  location: LocationCoordinates | null;
  isSubmitting: boolean;
  onAdvanceStage: () => void;
  onSubmit: () => void;
  onOpenCatalog?: () => void;
  createdRequestId?: string;
  onFindTechnicians?: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  stage,
  deviceBrand,
  deviceModel,
  selectedIssueIds,
  description,
  onChangeDescription,
  onSendDescription,
  photos,
  voiceNoteUrl,
  location,
  isSubmitting,
  onAdvanceStage,
  onSubmit,
  onOpenCatalog,
  createdRequestId,
  onFindTechnicians,
}) => {
  const isLocationValid = Boolean(
    location &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      (location.lat !== 0 || location.lng !== 0) &&
      (location.address || location.area || location.city || location.source === 'GPS' || location.source === 'GEOCODED')
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSendDescription();
    }
  };

  return (
    <div
      id="fixhub-chat-composer"
      className="sticky bottom-0 z-20 w-full border-t border-slate-200 bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg transition-all"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* STAGE: DEVICE */}
        {stage === 'device' && (
          <div className="flex items-center justify-between gap-2 animate-fadeIn">
            {deviceBrand && deviceModel ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Device Ready</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{deviceBrand} {deviceModel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAdvanceStage}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Select your device above or search our catalog
                </p>
                {onOpenCatalog && (
                  <button
                    type="button"
                    onClick={onOpenCatalog}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Open Catalog
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* STAGE: ISSUES */}
        {stage === 'issues' && (
          <div className="flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                  selectedIssueIds.length > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {selectedIssueIds.length} {selectedIssueIds.length === 1 ? 'issue' : 'issues'} selected
              </span>
            </div>

            <button
              type="button"
              disabled={selectedIssueIds.length === 0}
              onClick={onAdvanceStage}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              <span>Continue with {selectedIssueIds.length} {selectedIssueIds.length === 1 ? 'problem' : 'problems'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE: DESCRIPTION */}
        {stage === 'description' && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <div className="relative flex-1">
              <input
                type="text"
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe problem or symptoms..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {description.trim().length > 0 && (
                <button
                  type="button"
                  onClick={onSendDescription}
                  className="absolute right-1.5 top-1.5 bottom-1.5 w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!description.trim() ? (
              <button
                type="button"
                onClick={onAdvanceStage}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Skip
              </button>
            ) : (
              <button
                type="button"
                onClick={onSendDescription}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* STAGE: EVIDENCE */}
        {stage === 'evidence' && (
          <div className="flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 truncate">
              <span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-700">
                {photos.length}/3 photos
              </span>
              {voiceNoteUrl && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                  Voice Note attached
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onAdvanceStage}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{photos.length > 0 || voiceNoteUrl ? 'Continue' : 'Skip Evidence'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE: LOCATION */}
        {stage === 'location' && (
          <div className="flex items-center justify-between gap-3 animate-fadeIn">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Repair Hub</p>
              <p className="text-xs font-bold text-slate-800 truncate">
                {location?.area || location?.city || location?.address || 'Choose repair area'}
              </p>
            </div>

            <button
              type="button"
              disabled={!isLocationValid}
              onClick={onAdvanceStage}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              <span>Confirm Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE: REVIEW */}
        {stage === 'review' && (
          <div className="flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Protected by Fix Hub Escrow</span>
              <span className="sm:hidden">Escrow Protected</span>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSubmit}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STAGE: SUBMITTING */}
        {stage === 'submitting' && (
          <div className="flex items-center justify-center gap-2 py-1 text-xs text-slate-500 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Broadcasting request to verified local repair labs...</span>
          </div>
        )}

        {/* STAGE: SUBMITTED */}
        {stage === 'submitted' && onFindTechnicians && (
          <div className="flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Request Confirmed</span>
            </div>

            <button
              type="button"
              onClick={onFindTechnicians}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>View Matched Quotes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
