import React, { useState } from 'react';
import { RepairJob, RepairQuote, ConditionReport, PartUsedRecord } from '../../types';
import { ApiClient } from '../../api/client';
import { StatusBadge } from '../common/StatusBadge';
import {
  Wrench,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowLeft,
  Plus,
  QrCode,
  DollarSign,
  Clock,
  Sparkles,
  Check,
  X
} from 'lucide-react';

interface TechnicianJobWorkspaceProps {
  job: RepairJob;
  quote?: RepairQuote | null;
  onBack: () => void;
  onRefresh: () => void;
  onOpenChat: () => void;
}

export const TechnicianJobWorkspace: React.FC<TechnicianJobWorkspaceProps> = ({
  job,
  quote,
  onBack,
  onRefresh,
  onOpenChat,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intake condition form
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [frontCondition, setFrontCondition] = useState('CRACKED');
  const [backCondition, setBackCondition] = useState('MINOR_SCRATCHES');
  const [screenPowersOn, setScreenPowersOn] = useState(true);
  const [frameCondition, setFrameCondition] = useState('PRISTINE');
  const [techNotes, setTechNotes] = useState('Intake confirmed in shop.');

  // Additional Diagnosis form
  const [showAdditionalModal, setShowAdditionalModal] = useState(false);
  const [addTitle, setAddTitle] = useState('Swollen Battery Pack Discovered');
  const [addDesc, setAddDesc] = useState('Battery pack is swollen by 20%, risking display separation.');
  const [addCost, setAddCost] = useState<number>(15000);

  // Add Part form
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partName, setPartName] = useState('iPhone 13 OLED Assembly (Hard OLED)');
  const [partQuality, setPartQuality] = useState('PREMIUM_AFTERMARKET');
  const [partPrice, setPartPrice] = useState<number>(45000);
  const [partSerial, setPartSerial] = useState('SN-IP13-OLED-9821');

  // Drop-off Verification
  const [enteredDropOffCode, setEnteredDropOffCode] = useState('');
  const [dropOffSuccess, setDropOffSuccess] = useState(false);

  // Pickup Verification
  const [enteredPickupCode, setEnteredPickupCode] = useState('');
  const [codeSuccess, setCodeSuccess] = useState(false);

  const handleStatusChange = async (newStatus: string, note?: string) => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.updateJobStatus(job.id, newStatus, note);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveIntake = async () => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.checkInDevice(job.id, {
        frontCondition,
        backCondition,
        frameCondition,
        screenPowersOn,
        touchResponsive: true,
        cameraWorking: true,
        existingDamageNotes: techNotes,
        accessoriesReceived: ['Phone only', 'Protective case'],
        technicianNotes: techNotes,
        photos: [
          'https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600&auto=format&fit=crop&q=80',
        ],
      });
      setShowIntakeModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save intake report');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddPart = async () => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.addPartUsed(job.id, {
        partName,
        quality: partQuality,
        priceNaira: Number(partPrice),
        serialNumber: partSerial,
        warrantyDays: 90,
      });
      setShowAddPartModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record part');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveAdditional = async () => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.submitAdditionalDiagnosis(job.id, {
        title: addTitle,
        description: addDesc,
        additionalCostNaira: Number(addCost),
        additionalLaborHours: 1,
      });
      setShowAdditionalModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit additional diagnosis');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerifyDropOffCode = async () => {
    if (!enteredDropOffCode.trim()) {
      setErrorMsg('Please enter the customer drop-off code.');
      return;
    }
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.verifyDropOff(job.id, enteredDropOffCode.trim().toUpperCase());
      setDropOffSuccess(true);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || `Invalid code. Enter customer drop-off code (Demo: ${job.dropOffCode})`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerifyPickupCode = async () => {
    if (!enteredPickupCode.trim()) {
      setErrorMsg('Please enter the customer pickup code.');
      return;
    }
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await ApiClient.verifyPickup(job.id, enteredPickupCode.trim().toUpperCase());
      setCodeSuccess(true);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || `Invalid code. Enter customer pickup code (Demo: ${job.pickupCode})`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div id="technician-job-workspace" className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-white">
              {job.deviceBrand} {job.deviceModel}
            </h2>
            <StatusBadge status={job.status} size="lg" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Work Order: <span className="font-mono text-cyan-300 font-bold">{job.id}</span> • Customer Payment: <strong className="text-emerald-400">₦{job.finalAmount.toLocaleString()}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenChat}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            Chat Customer
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* WORKFLOW CONTROLS TOOLBAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-600" />
          <span>Repair Workflow Action Center</span>
        </h3>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Step 1: Drop-off code required notice */}
          {job.status === 'BOOKED' && (
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
              Drop-off Code verification required below before recording intake check-in
            </span>
          )}

          {/* Step 1: Intake Check-in (after drop-off code verified) */}
          {job.status === 'DEVICE_DROPPED_OFF' && !job.conditionReport && (
            <button
              id="tech-intake-device-btn"
              onClick={() => setShowIntakeModal(true)}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Record Device Intake Checklist & Check In</span>
            </button>
          )}

          {/* Step 2: Diagnostics */}
          {job.status === 'DEVICE_RECEIVED' && (
            <button
              id="tech-start-diagnostics-btn"
              onClick={() => handleStatusChange('DIAGNOSING', 'Started initial disassembly and diagnostic scan')}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Mark Diagnostic Scan In Progress</span>
            </button>
          )}

          {/* Step 3: Start Repair */}
          {job.status === 'DIAGNOSING' && (
            <>
              <button
                id="tech-start-repair-btn"
                onClick={() => handleStatusChange('REPAIR_IN_PROGRESS', 'Bench repair commenced')}
                disabled={isUpdating}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>Start Bench Repair</span>
              </button>
              <button
                onClick={() => setShowAdditionalModal(true)}
                disabled={isUpdating}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Report Additional Issue</span>
              </button>
            </>
          )}

          {/* Step 3b: Additional Diagnosis Awaiting Customer Approval */}
          {job.status === 'ADDITIONAL_DIAGNOSIS' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Awaiting Customer Approval for Additional Issue</span>
              </span>
              <button
                onClick={onOpenChat}
                className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl border border-blue-200 transition-colors cursor-pointer"
              >
                Message Customer
              </button>
            </div>
          )}

          {/* Step 4: Add Part Used */}
          {['REPAIR_IN_PROGRESS', 'DIAGNOSING'].includes(job.status) && (
            <button
              id="tech-add-part-btn"
              onClick={() => setShowAddPartModal(true)}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Installed Part</span>
            </button>
          )}

          {/* Step 5: Mark Ready for Pickup */}
          {job.status === 'REPAIR_IN_PROGRESS' && (
            <button
              id="tech-mark-ready-pickup-btn"
              onClick={() => handleStatusChange('READY_FOR_PICKUP', 'Device reassembled, tested, and ready for pickup')}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Ready for Pickup</span>
            </button>
          )}

          {job.status === 'COMPLETED' && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              ✓ Repair Completed & Payment Released to Your Available Payout Balance
            </span>
          )}

          {job.status === 'DISPUTED' && (
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              ⚠ Job Disputed — Escrow Funds On Hold Under Fixhub Mediation
            </span>
          )}
        </div>
      </div>

      {/* DISPUTED STATUS PANEL FOR TECHNICIAN */}
      {job.status === 'DISPUTED' && (
        <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Customer Raised a Dispute</span>
            </h4>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
              Under Fixhub Review
            </span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            The customer reported an issue with the repair. Escrow payout release is paused pending resolution. Please message the customer directly to resolve the issue or perform any corrective adjustments.
          </p>
          {(job as any).disputeReason && (
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs space-y-1">
              <span className="font-bold text-slate-800">Customer's Reported Issue:</span>
              <p className="text-slate-600 italic">"{(job as any).disputeReason}"</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => handleStatusChange('REPAIR_IN_PROGRESS', 'Technician reopened repair to address dispute findings')}
              disabled={isUpdating}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Resume Repair & Fix Issue
            </button>
            <button
              onClick={onOpenChat}
              className="font-bold text-xs text-blue-700 underline hover:text-blue-900 cursor-pointer"
            >
              Open Direct Chat with Customer
            </button>
          </div>
        </div>
      )}

      {/* ADDITIONAL DIAGNOSIS PENDING CUSTOMER APPROVAL PANEL */}
      {job.status === 'ADDITIONAL_DIAGNOSIS' && (
        <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Additional Issue Pending Customer Approval</span>
            </h4>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
              Customer Response Needed
            </span>
          </div>

          <p className="text-xs text-amber-900 leading-relaxed">
            You reported an additional issue discovered during diagnostics. Customer has been notified in real time to approve or decline the new scope.
          </p>

          {job.additionalDiagnosis && (
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{job.additionalDiagnosis.title}</span>
                <span className="text-amber-900 font-extrabold">+₦{job.additionalDiagnosis.additionalCostNaira.toLocaleString()}</span>
              </div>
              <p className="text-slate-600 italic">"{job.additionalDiagnosis.description}"</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-amber-800 pt-1">
            <span>• If approved: Work order amount updates and job automatically returns to Repair In Progress.</span>
            <button
              onClick={onOpenChat}
              className="font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
            >
              Contact Customer
            </button>
          </div>
        </div>
      )}

      {/* DROP-OFF CODE VERIFICATION BOX (REQUIRED BEFORE CHECK-IN) */}
      {job.status === 'BOOKED' && (
        <div className="p-5 bg-blue-50 border-2 border-blue-300 rounded-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-700" />
              <span>Customer Drop-off Verification</span>
            </h4>
            <span className="text-xs font-bold text-blue-800">Counter Drop Off Required</span>
          </div>
          <p className="text-xs text-blue-800">
            Ask the customer for their 6-digit Drop-off Code to verify device handover at the shop counter before recording check-in.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={enteredDropOffCode}
              onChange={(e) => setEnteredDropOffCode(e.target.value.toUpperCase())}
              placeholder={`e.g. ${job.dropOffCode}`}
              maxLength={7}
              className="p-2.5 bg-white border border-blue-300 rounded-xl text-base font-mono font-bold text-slate-900 tracking-wider max-w-[180px] text-center focus:ring-2 focus:ring-blue-500 uppercase"
            />
            <button
              onClick={handleVerifyDropOffCode}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              Verify Drop-off Code
            </button>
            {dropOffSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Drop-off verified! Status updated to Drop Off.
              </span>
            )}
          </div>
        </div>
      )}

      {/* PICKED UP STATUS BANNER */}
      {job.status === 'PICKED_UP' && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Pickup Verified — Device Handed Over to Customer</span>
          </div>
          <p className="text-xs text-emerald-800">
            Customer has verified the device at the shop and is confirming completion to release payment to your payout balance.
          </p>
        </div>
      )}

      {/* PICKUP CODE VERIFICATION BOX */}
      {job.status === 'READY_FOR_PICKUP' && (
        <div className="p-5 bg-teal-50 border-2 border-teal-300 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-teal-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-700" />
              <span>Customer Pickup Verification</span>
            </h4>
            <span className="text-xs font-bold text-teal-800">Shop Counter Handoff</span>
          </div>
          <p className="text-xs text-teal-800">
            Ask the customer for their Pickup Code to verify identity before handing over the device.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={enteredPickupCode}
              onChange={(e) => setEnteredPickupCode(e.target.value.toUpperCase())}
              placeholder={`e.g. ${job.pickupCode}`}
              maxLength={7}
              className="p-2.5 bg-white border border-teal-300 rounded-xl text-base font-mono font-bold text-slate-900 tracking-wider max-w-[180px] text-center focus:ring-2 focus:ring-teal-500 uppercase"
            >
            </input>
            <button
              onClick={handleVerifyPickupCode}
              disabled={isUpdating}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              Verify Code
            </button>
            {codeSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Code Verified! Status updated to Picked Up.
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2-Column Details (Condition Report & Parts Installed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Physical Intake Record */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Device Condition Record</h4>
            {job.conditionReport && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ Recorded
              </span>
            )}
          </div>

          {job.conditionReport ? (
            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">Front:</span> {job.conditionReport.frontCondition}</div>
                <div><span className="text-slate-400">Back:</span> {job.conditionReport.backCondition}</div>
                <div><span className="text-slate-400">Frame:</span> {job.conditionReport.frameCondition}</div>
                <div><span className="text-slate-400">Powers On:</span> {job.conditionReport.screenPowersOn ? 'Yes' : 'No'}</div>
              </div>
              {job.conditionReport.technicianNotes && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                  Notes: {job.conditionReport.technicianNotes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3 text-center">No intake checklist recorded yet.</p>
          )}
        </div>

        {/* Installed Parts Record */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Installed Parts Record</h4>
            <span className="text-xs text-slate-400 font-semibold">{job.partsUsed.length} Parts</span>
          </div>

          {job.partsUsed.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">No parts recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {job.partsUsed.map((part) => (
                <div key={part.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{part.partName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">SN: {part.serialNumber}</p>
                  </div>
                  <span className="font-bold text-slate-900">₦{part.priceNaira.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: INTAKE CHECKLIST */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Device Intake Condition Checklist</h3>
              <button onClick={() => setShowIntakeModal(false)}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block text-slate-700 mb-1">Front Screen Condition</label>
                <select
                  value={frontCondition}
                  onChange={(e) => setFrontCondition(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="PERFECT">PERFECT - Pristine / Flawless</option>
                  <option value="MINOR_SCRATCHES">MINOR_SCRATCHES - Light cosmetic wear</option>
                  <option value="CRACKED">CRACKED - Hairline or localized crack</option>
                  <option value="SHATTERED">SHATTERED - Severely shattered / bleeding LCD</option>
                </select>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Back Housing Condition</label>
                <select
                  value={backCondition}
                  onChange={(e) => setBackCondition(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="PERFECT">PERFECT - Like new</option>
                  <option value="MINOR_SCRATCHES">MINOR_SCRATCHES - Minor surface marks</option>
                  <option value="CRACKED">CRACKED - Cracked back glass</option>
                  <option value="SHATTERED">SHATTERED - Shattered rear glass/camera ring</option>
                </select>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Chassis / Frame Condition</label>
                <select
                  value={frameCondition}
                  onChange={(e) => setFrameCondition(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="PRISTINE">PRISTINE - Straight and clean</option>
                  <option value="SCUFFED">SCUFFED - Corner scuffs / paint wear</option>
                  <option value="BENT">BENT - Slight chassis curve</option>
                  <option value="DENTED">DENTED - Impact corner dents</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={screenPowersOn}
                    onChange={(e) => setScreenPowersOn(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Device Powers On</span>
                </label>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Technician Intake Notes</label>
                <textarea
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  placeholder="Notes on physical intake inspection..."
                />
              </div>
            </div>

            <button
              onClick={handleSaveIntake}
              disabled={isUpdating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Save Intake & Move to Checked In
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD PART USED */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Record Installed Part</h3>
              <button onClick={() => setShowAddPartModal(false)}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              {quote?.items && quote.items.length > 0 && (
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Select from Quoted Parts:</label>
                  <div className="space-y-1">
                    {quote.items.map((item) => {
                      const pName = item.partNameSnapshot || (item as any).partName || 'Replacement Part';
                      const pQuality = item.qualitySnapshot || (item as any).quality || quote.partsQuality || 'PREMIUM_AFTERMARKET';
                      const pPrice = item.unitPriceSnapshot ?? (item as any).unitPriceNaira ?? 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPartName(pName);
                            setPartQuality(pQuality);
                            setPartPrice(pPrice);
                          }}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 flex items-center justify-between text-xs transition-colors"
                        >
                          <span className="font-bold text-slate-800">{pName}</span>
                          <span className="text-purple-700 font-bold">₦{pPrice.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold block text-slate-700 mb-1">Part Description</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={partSerial}
                    onChange={(e) => setPartSerial(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Cost (₦)</label>
                  <input
                    type="number"
                    value={partPrice}
                    onChange={(e) => setPartPrice(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddPart}
              disabled={isUpdating}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Add Part to Digital Passport
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADDITIONAL DIAGNOSIS */}
      {showAdditionalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Report Newly Discovered Issue</h3>
              <button onClick={() => setShowAdditionalModal(false)}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block text-slate-700 mb-1">Issue Title</label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold block text-slate-700 mb-1">Explanation & Technical Finding</label>
                <textarea
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold block text-slate-700 mb-1">Additional Cost (₦)</label>
                <input
                  type="number"
                  value={addCost}
                  onChange={(e) => setAddCost(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleSaveAdditional}
              disabled={isUpdating}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Submit to Customer for Approval
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
