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
  onPay?: (job: RepairJob) => void;
}

export const ActiveRepairTracker: React.FC<ActiveRepairTrackerProps> = ({
  job,
  technician,
  quote,
  onOpenChat,
  onRefresh,
  onOpenReviewModal,
  onPay,
}) => {
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [isRespondingDiagnosis, setIsRespondingDiagnosis] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const steps = [
    {
      label: 'Booked',
      done: [
        'BOOKED',
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Drop Off',
      done: [
        'DEVICE_DROPPED_OFF',
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Checked In',
      done: [
        'DEVICE_RECEIVED',
        'DIAGNOSING',
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Diagnosis & Repair',
      done: [
        'REPAIR_IN_PROGRESS',
        'ADDITIONAL_DIAGNOSIS',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Ready for Pickup',
      done: [
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Picked Up',
      done: [
        'PICKED_UP',
        'COMPLETED',
      ].includes(job.status),
    },
    {
      label: 'Warranty',
      done: job.status === 'COMPLETED',
    },
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

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) return;
    setIsSubmittingDispute(true);
    setActionError(null);
    try {
      const res = await ApiClient.disputeJob(job.id, disputeReason.trim());
      if (res.success) {
        setShowDisputeModal(false);
        setDisputeReason('');
        onRefresh();
      } else {
        setActionError(res.error || 'Failed to submit dispute');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit dispute');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleCancelJob = async () => {
    setIsSubmittingCancel(true);
    setActionError(null);
    try {
      const res = await ApiClient.cancelJob(job.id, cancelReason.trim() || undefined);
      if (res.success) {
        setShowCancelModal(false);
        setCancelReason('');
        onRefresh();
      } else {
        setActionError(res.error || 'Failed to cancel repair');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel repair');
    } finally {
      setIsSubmittingCancel(false);
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

          <div className="flex flex-wrap items-center gap-2">
            {['PAYMENT_PENDING', 'BOOKED'].includes(job.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                <span>Cancel Repair</span>
              </button>
            )}
            {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'].includes(job.status) && (
              <button
                onClick={() => setShowDisputeModal(true)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-amber-900/60 text-slate-300 hover:text-amber-200 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Report Issue</span>
              </button>
            )}
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>
                {job.status === 'READY_FOR_PICKUP' || job.status === 'PICKED_UP'
                  ? 'Pickup Code'
                  : 'Drop-off Code'}
              </span>
            </button>
            <button
              onClick={onOpenChat}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        {/* Multi-step Visual Tracker */}
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Repair Progress</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center text-xs">
            {steps.map((s, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-xl border transition-all ${
                  s.done
                    ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 font-semibold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-500 font-normal'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {s.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border border-slate-600" />
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] leading-tight block">{s.label}</span>
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

      {/* DISPUTED STATUS BANNER */}
      {job.status === 'DISPUTED' && (
        <div className="p-6 rounded-2xl bg-amber-950 border-2 border-amber-500/50 text-white shadow-xl space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400 font-extrabold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Dispute Under Fixhub Review</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            A dispute has been raised for this repair. Escrow funds remain safely locked and will not be released to the technician until Fixhub mediation reviews your case.
          </p>
          {(job as any).disputeReason && (
            <div className="p-3 bg-amber-900/40 rounded-xl border border-amber-600/30 text-xs">
              <span className="font-semibold text-amber-300">Reason reported: </span>
              <span className="text-amber-100">"{(job as any).disputeReason}"</span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={onOpenChat}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Chat with Technician
            </button>
          </div>
        </div>
      )}

      {/* CANCELLED STATUS BANNER */}
      {job.status === 'CANCELLED' && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-950 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Repair Cancelled</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            This repair has been cancelled. {(job as any).cancelReason ? `Reason: ${(job as any).cancelReason}` : ''}
          </p>
        </div>
      )}

      {/* PAYMENT PENDING BANNER & ESCROW CHECKOUT ACTION */}
      {job.status === 'PAYMENT_PENDING' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white shadow-xl space-y-4 border border-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1 border border-emerald-400/30">
                Action Required • Payment Pending
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Complete Escrow Payment to Book Repair
              </h3>
              <p className="text-xs text-emerald-100/90 mt-1 max-w-lg leading-relaxed">
                Your quote was accepted. To generate your 6-digit drop-off code and dispatch the work order to {technician?.businessName || 'the technician'}, deposit your payment into Fixhub Escrow. Funds are safely held until you verify the completed repair.
              </p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl text-center border border-white/20 shrink-0">
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Amount</span>
              <span className="text-xl font-black text-white">₦{(job.finalAmount || job.originalQuoteAmount || job.totalAmountNaira || 0).toLocaleString()}</span>
            </div>
          </div>

          {onPay && (
            <button
              id="pay-pending-repair-btn"
              onClick={() => onPay(job)}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5 text-slate-950" />
              <span>Complete Escrow Payment (₦{(job.finalAmount || job.originalQuoteAmount || job.totalAmountNaira || 0).toLocaleString()})</span>
            </button>
          )}
        </div>
      )}

      {/* DROP-OFF BANNER (WHEN JOB IS BOOKED) */}
      {job.status === 'BOOKED' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider mb-1">
                Drop Off Required
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Deliver Your Device to the Shop
              </h3>
              <p className="text-xs text-blue-100 mt-1 max-w-lg leading-relaxed">
                Take your phone to {technician?.businessName || 'the shop'}. Show your 6-digit Drop-off Code at the counter so the technician can verify receipt before check-in.
              </p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl text-center border border-white/20 shrink-0">
              <span className="text-[10px] uppercase font-bold text-blue-100 block">Drop-off Code</span>
              <span className="text-xl font-mono font-black text-white tracking-wider">{job.dropOffCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE DROPPED OFF BANNER */}
      {job.status === 'DEVICE_DROPPED_OFF' && (
        <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-200 text-purple-950 space-y-2">
          <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
            <span>Drop Off Verified</span>
          </div>
          <p className="text-xs text-purple-800 leading-relaxed">
            Your device was handed over and the technician verified your Drop-off Code. Technician check-in and condition assessment is starting shortly.
          </p>
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

      {/* READY FOR PICKUP BANNER */}
      {job.status === 'READY_FOR_PICKUP' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider mb-1">
                Ready for Pickup
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Your Device is Ready for Pickup!
              </h3>
              <p className="text-xs text-teal-100 mt-1 max-w-lg leading-relaxed">
                Visit {technician?.businessName || 'the shop'} to test and collect your device. Present your Pickup Code to the technician at the counter.
              </p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl text-center border border-white/20 shrink-0">
              <span className="text-[10px] uppercase font-bold text-teal-100 block">Pickup Code</span>
              <span className="text-xl font-mono font-black text-white tracking-wider">{job.pickupCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* PICKED UP BANNER & CONFIRM REPAIR ACTION */}
      {job.status === 'PICKED_UP' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider mb-1">
                Picked Up
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Inspect Device & Confirm Repair
              </h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-lg leading-relaxed">
                Your device has been handed over by the technician. Please test your screen, camera, and device functions. Tap Confirm Repair below to release payment to the technician and activate your official 90-day warranty.
              </p>
            </div>
          </div>

          <button
            id="confirm-pickup-release-funds-btn"
            onClick={handleConfirmCompletion}
            disabled={isConfirmingPickup}
            className="w-full py-3.5 bg-white hover:bg-slate-100 text-emerald-900 font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{isConfirmingPickup ? 'Releasing Payment & Activating Warranty...' : 'Confirm Repair'}</span>
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
              <span>Checked In Condition Report</span>
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
                  Technician Remarks: {job.conditionReport.technicianNotes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3 text-center">
              A physical condition report will be recorded when you drop off the device at the shop.
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
                        {(part.quality || 'ORIGINAL_OEM').replace(/_/g, ' ')}
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

      {/* Drop-off & Pickup Verification Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Verification Codes</h3>
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
              Provide your Drop-off Code when delivering your device, and your Pickup Code when collecting your device.
            </p>
          </div>
        </div>
      )}

      {/* Raise Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Report an Issue / Dispute</span>
              </h3>
              <button onClick={() => setShowDisputeModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If the repair was done incorrectly, parts failed tests, or there is an unresolved issue with the shop, submitting a dispute locks escrow funds until Fixhub mediation resolves the case.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Please describe the problem:</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. Screen touch is unresponsive on the left side, or device casing not fitted properly..."
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRaiseDispute}
                disabled={!disputeReason.trim() || isSubmittingDispute}
                className="px-5 py-2 text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Repair Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Cancel Repair Request</span>
              </h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                {actionError}
              </div>
            )}

            {job.status !== 'PAYMENT_PENDING' ? (
              <div className="space-y-2">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <p className="text-xs font-bold text-amber-900">
                    Escrow Refund Notice
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Since you've already paid, this repair will be cancelled and your full escrow deposit of{' '}
                    <span className="font-bold text-slate-900">
                      ₦{(job.finalAmount || job.originalQuoteAmount || quote?.totalAmount || 0).toLocaleString()}
                    </span>{' '}
                    will be refunded to your original payment method via Paystack within 3–5 business days.
                  </p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Any reserved inventory parts will be released immediately. If you have already dropped off your device, please coordinate physical pickup with the technician.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                You have not made payment yet. Cancelling this repair will close the booking and release any reserved parts with no fee.
              </p>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Reason for cancellation (optional):</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Decided to upgrade device or found an alternate fix..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Keep Repair
              </button>
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={isSubmittingCancel}
                className="px-5 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
