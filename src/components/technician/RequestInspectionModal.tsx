import React, { useState } from 'react';
import { RepairRequest } from '../../types';
import {
  X,
  Smartphone,
  MapPin,
  Calendar,
  Volume2,
  Image as ImageIcon,
  DollarSign,
  AlertCircle,
  Clock,
  Shield,
} from 'lucide-react';

interface RequestInspectionModalProps {
  request: RepairRequest;
  onClose: () => void;
  onOpenQuoteBuilder: () => void;
}

export const RequestInspectionModal: React.FC<RequestInspectionModalProps> = ({
  request,
  onClose,
  onOpenQuoteBuilder,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const photos = request.photos || (request.attachments || [])
    .filter((a) => a.type === 'IMAGE')
    .map((a) => a.url);

  const audioAttachment = request.voiceNoteUrl || (request.attachments || []).find((a) => a.type === 'AUDIO')?.url;

  return (
    <div id="request-inspection-modal" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {request.deviceBrand} {request.deviceModel}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {request.customerLocation?.area || request.customerLocation?.city || 'Local Area'}
                  {(request as any).estimatedDistanceKm !== undefined ? ` (~${(request as any).estimatedDistanceKm} km away)` : ''}
                </span>
              </p>
            </div>
          </div>
          <button id="close-inspection-btn" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reported Issues Badges */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Reported Symptoms & Issues
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(request.issues || []).map((issue, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
              >
                {issue.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Customer Problem Description */}
        {request.description && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Customer Problem Statement
            </label>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed italic">
              "{request.description}"
            </div>
          </div>
        )}

        {/* Customer Uploaded Evidence / Photos */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Customer Device Photos ({photos.length})</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photoUrl, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(photoUrl)}
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity relative group bg-slate-100"
                >
                  <img
                    src={photoUrl}
                    alt={`Device inspection ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    View Full
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox for Selected Photo */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-xl max-h-[80vh]">
              <img
                src={selectedPhoto}
                alt="Enlarged inspection view"
                className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full cursor-pointer hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Voice Note Audio Player */}
        {audioAttachment && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Customer Audio Voice Note</span>
            </label>
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3">
              <audio controls src={audioAttachment} className="w-full h-8" />
            </div>
          </div>
        )}

        {/* Information & Privacy Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
          <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Customer phone number and exact street address remain private until the customer accepts your quote and creates a confirmed booking.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            id="open-quote-builder-from-inspect-btn"
            onClick={() => {
              onClose();
              onOpenQuoteBuilder();
            }}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <DollarSign className="w-4 h-4" />
            <span>Prepare Transparent Quote</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
