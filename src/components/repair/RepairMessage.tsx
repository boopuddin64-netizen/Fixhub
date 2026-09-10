import React from 'react';
import { Edit2, Shield, Smartphone, Wrench, FileText, Camera, Volume2, MapPin, CheckCircle2 } from 'lucide-react';

export interface RepairMessageProps {
  sender?: 'assistant' | 'customer';
  title?: string;
  subtitle?: string;
  summaryText?: string;
  badges?: string[];
  photos?: string[];
  voiceNoteUrl?: string;
  voiceNoteDuration?: number;
  locationDetails?: {
    address?: string;
    area?: string;
    city?: string;
    state?: string;
  };
  type?: 'device' | 'issues' | 'description' | 'evidence' | 'location' | 'general';
  onEdit?: () => void;
  children?: React.ReactNode;
  timestamp?: string;
}

export const RepairMessage: React.FC<RepairMessageProps> = ({
  sender = 'customer',
  title,
  subtitle,
  summaryText,
  badges = [],
  photos = [],
  voiceNoteUrl,
  voiceNoteDuration,
  locationDetails,
  type = 'general',
  onEdit,
  children,
  timestamp,
}) => {
  if (sender === 'assistant') {
    return (
      <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[88%] mr-auto animate-fadeIn">
        {/* Fix Hub Assistant Avatar */}
        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 border border-slate-800">
          <Shield className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-800 tracking-tight">Fix Hub Assistant</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Online" />
            {timestamp && <span className="text-[10px] text-slate-400">{timestamp}</span>}
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 shadow-2xs text-slate-800 text-xs sm:text-sm leading-relaxed">
            {summaryText && <p className="font-medium">{summaryText}</p>}
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Customer Response Bubble (Accumulated Answer)
  const getIcon = () => {
    switch (type) {
      case 'device':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'issues':
        return <Wrench className="w-4 h-4 text-amber-400" />;
      case 'description':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'evidence':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      case 'location':
        return <MapPin className="w-4 h-4 text-rose-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="flex flex-col items-end max-w-[92%] sm:max-w-[82%] ml-auto animate-fadeIn space-y-1">
      <div className="flex items-center gap-1.5 pr-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">You</span>
        {title && <span className="text-[10px] text-slate-400">• {title}</span>}
      </div>

      <div className="w-full bg-slate-900 text-white rounded-2xl rounded-tr-xs p-3.5 sm:p-4 shadow-md border border-slate-800 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-700">
              {getIcon()}
            </div>
            <div className="min-w-0">
              {subtitle && <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{subtitle}</p>}
              {summaryText && (
                <p className="text-xs sm:text-sm font-semibold text-white break-words">
                  {summaryText}
                </p>
              )}
            </div>
          </div>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
              title="Edit this section"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}
        </div>

        {/* Badges (e.g. Issues selected) */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {badges.map((badge, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-slate-800/90 border border-slate-700 text-slate-200 text-[11px] font-medium rounded-md"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Photos Preview */}
        {photos.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {photos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shrink-0"
              >
                <img
                  src={photoUrl}
                  alt={`Evidence ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Voice Note Badge */}
        {voiceNoteUrl && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-emerald-300 font-medium">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Voice Note attached ({voiceNoteDuration ? `${voiceNoteDuration}s` : 'Recorded'})</span>
          </div>
        )}

        {/* Location Details */}
        {locationDetails && (
          <div className="text-[11px] text-slate-300 space-y-0.5 pt-0.5">
            {locationDetails.address && <p className="font-semibold text-white">{locationDetails.address}</p>}
            {(locationDetails.area || locationDetails.city) && (
              <p className="text-slate-400">
                {[locationDetails.area, locationDetails.city, locationDetails.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
