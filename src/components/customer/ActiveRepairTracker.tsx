import React, { useState } from 'react';
import { RepairJob, RepairQuote, TechnicianProfile } from '../../types';
import { ApiClient } from '../../api/client';
import { StatusBadge } from '../common/StatusBadge';
import confetti from 'canvas-confetti';
import {
  Wrench,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Camera,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface ActiveRepairTrackerProps {
  job: RepairJob;
  technician?: TechnicianProfile | null;
  quote?: RepairQuote | null;
  onOpenChat: () => void;
  onRefresh: () => void;
  onOpenReviewModal: () => void;
}

export const ActiveRepairTracker: React.FC<ActiveRepairTrackerProps> = ({
  job,
  technician,
  quote,
  onOpenChat,
  onRefresh,
  onOpenReviewModal,
}) => {
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [isRespondingDiagnosis, setIsRespondingDiagnosis] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const steps = [
    { label: 'Request & Quote', done: true },
    { label: 'Payment Confirmed', done: job.status !== 'REQUESTED' && job.status !== 'QUOTING' && job.status !== 'QUOTE_ACCEPTED' && job.status !== 'PAYMENT_PENDING' },
    { label: 'Device Intake', done: ['DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(job.status) },
    { label: 'Repair & Parts', done: ['REPAIR_IN_PROGRESS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(job.status) },
    { label: 'Ready for Pickup', done: ['READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(job.status) },
    { label: 'Complete & Warranty', done: job.status === 'COMPLETED' },
  ];

  const handleAdditionalDiagnosisResponse = async (approved: boolean) => {
    setIsRespondingDiagnosis(true);
    setActionError(null);
    try {
      await ApiClient.respondToAdditionalDiagnosis(job.id, approved);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update additional diagnosis');
    } finally {
      setIsRespondingDiagnosis(false);
    }
  };

  const handleConfirmCompletion = async () => {
    setIsConfirmingPickup(true);
    setActionError(null);
    try {
      await ApiClient.confirmJobCompletion(job.id);
      // Trigger festive celebration confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      onRefresh();
      setTimeout(() => {
        onOpenReviewModal();
      }, 800);
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete repair');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  return (
    <div id="active-repair-tracker" className="space-y-6">
      {/* Top Banner with Device, Status, & Quick Chat */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">
                {job.deviceBrand} {job.deviceModel}
              </h2>
              <StatusBadge status={job.status} size="lg" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Repair ID: <span className="font-mono text-cyan-300 font-semibold">{job.id}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Handoff QR / Code</span>
            </button>
            <button
              onClick={onOpenChat}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat Tech</span>
            </button>
          </div>
        </div>

        {/* Multi-step Visual Tracker */}
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Live Progression</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            {steps.map((s, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border transition-all ${
                  s.done
                    ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 font-semibold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-500 font-normal'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {s.done ? (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-slate-600" />
                  )}
                </div>
                <span className="text-[10px] leading-tight block">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ADDITIONAL DIAGNOSIS ALERT (IF TECHNICIAN FOUND NEW ISSUE) */}
      {job.additionalDiagnosis && job.additionalDiagnosis.status === 'PENDING_APPROVAL' && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Technician Action Required: Additional Issue Discovered</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            During diagnostic disassembly, technician discovered: <strong className="font-semibold">{job.additionalDiagnosis.title}</strong>
          </p>
          <p className="text-xs text-amber-800 italic">
            "{job.additionalDiagnosis.description}"
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-xs font-bold">
            <span>Additional Cost:</span>
            <span className="text-amber-900 text-sm">+₦{job.additionalDiagnosis.additionalCostNaira.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              id="approve-additional-diagnosis-btn"
              disabled={isRespondingDiagnosis}
              onClick={() => handleAdditionalDiagnosisResponse(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isRespondingDiagnosis ? 'Processing...' : `Approve (+₦${job.additionalDiagnosis.additionalCostNaira.toLocaleString()})`}
            </button>
            <button
              id="decline-additional-diagnosis-btn"
              disabled={isRespondingDiagnosis}
              onClick={() => handleAdditionalDiagnosisResponse(false)}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Decline & Keep Original Scope
            </button>
          </div>
        </div>
      )}

      {/* READY FOR PICKUP / PICKED UP BANNER & ACTION */}
      {(job.status === 'READY_FOR_PICKUP' || job.status === 'PICKED_UP') && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider mb-1">
                {job.status === 'PICKED_UP' ? 'Device Picked Up' : 'Ready for Pickup'}
              </span>
              <h3 className="text-lg font-extrabold text-white">
                {job.status === 'PICKED_UP'
                  ? 'Verify Repair & Complete'
                  : 'Your Device is Ready for Pickup!'}
              </h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-lg leading-relaxed">
                {job.status === 'PICKED_UP'
                  ? 'Your device was handed over. Confirm repair completion below to release payment to the technician and activate your official warranty passport.'
                  : `Visit the shop, present your Pickup Code (${job.pickupCode}), test your device, and tap below to complete and activate your warranty.`}
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl text-center border border-white/20 shrink-0">
              <span className="text-[10px] uppercase font-bold text-emerald-100 block">Pickup Code</span>
              <span className="text-lg font-mono font-black text-white">{job.pickupCode}</span>
            </div>
          </div>

          <button
            id="confirm-pickup-release-funds-btn"
            onClick={handleConfirmCompletion}
            disabled={isConfirmingPickup}
            className="w-full py-3.5 bg-white hover:bg-slate-100 text-emerald-900 font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{isConfirmingPickup ? 'Releasing Payment & Activating Warranty...' : 'Confirm Completion & Activate Warranty'}</span>
          </button>
        </div>
      )}

      {/* 2-Column Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Device Condition Scan Report (At Shop Check-in) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Digital Intake & Condition Scan</span>
            </h4>
            {job.conditionReport && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ Recorded at Shop
              </span>
            )}
          </div>

          {job.conditionReport ? (
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">Front Condition:</span>
                  <span className="font-bold text-slate-800">{job.conditionReport.frontCondition}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Back Housing:</span>
                  <span className="font-bold text-slate-800">{job.conditionReport.backCondition}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Screen Powers On:</span>
                  <span className="font-bold text-slate-800">{job.conditionReport.screenPowersOn ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Frame Condition:</span>
                  <span className="font-bold text-slate-800">{job.conditionReport.frameCondition}</span>
                </div>
              </div>

              {job.conditionReport.technicianNotes && (
                <p className="text-[11px] text-slate-500 italic bg-blue-50/50 p-2 rounded-lg">
                  Tech Notes: {job.conditionReport.technicianNotes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3 text-center">
              A physical condition scan will be logged when you drop off the device at the shop.
            </p>
          )}
        </div>

        {/* Parts Transparency Record */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Parts Transparency Log</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-semibold">{job.partsUsed.length} Part(s)</span>
          </div>

          {job.partsUsed.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              Parts and serial records will appear here as technician installs them.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {job.partsUsed.map((part) => (
                <div key={part.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{part.partName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                        {part.quality.replace('_', ' ')}
                      </span>
                      <span>• {part.warrantyDays} Days Warranty</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">₦{part.priceNaira.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Technician Shop Information Card */}
      {technician && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={technician.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
              alt={technician.businessName}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <h4 className="font-bold text-sm text-slate-900">{technician.businessName}</h4>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{technician.shopLocation.address} ({technician.shopLocation.landmark || technician.shopLocation.area})</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Hours: {technician.businessHours}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`tel:${technician.phone}`}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Shop</span>
            </a>
            <button
              onClick={onOpenChat}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Message</span>
            </button>
          </div>
        </div>
      )}

      {/* Handoff QR & Short Codes Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Secure Handoff Verification</h3>
              <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mx-auto">
              {/* Clean Vector QR Simulation with Secure Hash */}
              <div className="w-44 h-44 bg-white p-2 border-2 border-slate-900 rounded-xl flex flex-col items-center justify-center">
                <QrCode className="w-32 h-32 text-slate-900" />
                <span className="text-[9px] font-mono text-slate-400 mt-1 truncate max-w-[150px]">{job.handoffQrToken}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-100 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Drop-off Code</span>
                <span className="text-base font-mono font-extrabold text-blue-700">{job.dropOffCode}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">Pickup Code</span>
                <span className="text-base font-mono font-extrabold text-emerald-800">{job.pickupCode}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Present this screen or provide your 6-digit code to the technician during physical handoff.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
