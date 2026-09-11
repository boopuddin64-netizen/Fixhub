import React, { useState, useEffect } from 'react';
import { RepairRequest, RepairJob, RepairQuote, TechnicianProfile } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { QuoteBuilderModal } from './QuoteBuilderModal';
import { RequestInspectionModal } from './RequestInspectionModal';
import {
  LayoutDashboard,
  Wrench,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MapPin,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Power,
  Eye,
  FileText,
  Trash2,
  Check,
  Wallet,
  ArrowDownToLine,
  Building,
} from 'lucide-react';

interface TechnicianDashboardViewProps {
  onOpenJob: (jobId: string) => void;
  onRefresh: () => void;
}

export const TechnicianDashboardView: React.FC<TechnicianDashboardViewProps> = ({
  onOpenJob,
  onRefresh,
}) => {
  const { user, technicianProfile, refreshUser } = useAuth();
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [myQuotes, setMyQuotes] = useState<any[]>([]);
  const [financials, setFinancials] = useState<{
    heldEarningsNaira: number;
    availablePayoutNaira: number;
    lockedInProcessingNaira: number;
    totalCompletedPayoutsNaira: number;
    commissionRatePercent: number;
  }>({
    heldEarningsNaira: 0,
    availablePayoutNaira: 0,
    lockedInProcessingNaira: 0,
    totalCompletedPayoutsNaira: 0,
    commissionRatePercent: 8.5,
  });
  const [earningsList, setEarningsList] = useState<any[]>([]);
  const [payoutList, setPayoutList] = useState<any[]>([]);
  const [payoutAmountInput, setPayoutAmountInput] = useState<string>('');
  const [payoutBank, setPayoutBank] = useState<string>(technicianProfile?.bankDetails?.bankName || '');
  const [payoutAccountNum, setPayoutAccountNum] = useState<string>(technicianProfile?.bankDetails?.accountNumber || '');
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [inspectingRequest, setInspectingRequest] = useState<RepairRequest | null>(null);
  const [selectedRequestForQuote, setSelectedRequestForQuote] = useState<RepairRequest | null>(null);
  const [availability, setAvailability] = useState<string>(technicianProfile?.availabilityStatus || 'AVAILABLE');
  const [isUpdatingAvail, setIsUpdatingAvail] = useState(false);
  const [activeTab, setActiveTab] = useState<'LEADS' | 'MY_QUOTES' | 'WORK_ORDERS' | 'FINANCES'>('LEADS');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const [reqList, jobList, quotesList, finData] = await Promise.all([
        ApiClient.getRepairRequests().catch(() => []),
        ApiClient.getJobs().catch(() => []),
        ApiClient.getMyQuotes().catch(() => []),
        ApiClient.getTechnicianEarnings().catch(() => null),
      ]);
      setRequests(Array.isArray(reqList) ? reqList : []);
      setJobs(Array.isArray(jobList) ? jobList : []);
      setMyQuotes(Array.isArray(quotesList) ? quotesList : []);
      if (finData) {
        if (finData.summary) setFinancials(finData.summary);
        if (Array.isArray(finData.earnings)) setEarningsList(finData.earnings);
        if (Array.isArray(finData.payouts)) setPayoutList(finData.payouts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleToggleAvailability = async (newStatus: string) => {
    setIsUpdatingAvail(true);
    try {
      await ApiClient.setTechnicianAvailability(newStatus);
      setAvailability(newStatus);
      await refreshUser();
    } finally {
      setIsUpdatingAvail(false);
    }
  };

  const handleWithdrawQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to withdraw this quote?')) return;
    try {
      await ApiClient.withdrawQuote(quoteId);
      setActionMsg('Quote has been successfully withdrawn.');
      setTimeout(() => setActionMsg(null), 3000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to withdraw quote.');
    }
  };

  const handleRequestPayout = async () => {
    const amt = Number(payoutAmountInput);
    if (!amt || amt <= 0) {
      setPayoutMsg({ type: 'error', text: 'Please enter a valid payout amount in Naira.' });
      return;
    }
    if (amt > financials.availablePayoutNaira) {
      setPayoutMsg({
        type: 'error',
        text: `Requested amount exceeds available balance of ₦${financials.availablePayoutNaira.toLocaleString()}. (Note: Active repair funds are held until customer pickup).`,
      });
      return;
    }

    setIsRequestingPayout(true);
    setPayoutMsg(null);
    try {
      const res = await ApiClient.requestPayout(amt, {
        bankName: payoutBank,
        accountNumber: payoutAccountNum,
        bankCode: '044',
        accountName: technicianProfile?.businessName || user?.name || 'Technician',
      });
      if (!res.success) {
        setPayoutMsg({ type: 'error', text: res.error || 'Payout request failed.' });
      } else {
        setPayoutMsg({ type: 'success', text: `Payout request for ₦${amt.toLocaleString()} submitted successfully.` });
        setPayoutAmountInput('');
        fetchDashboardData();
      }
    } catch (err: any) {
      setPayoutMsg({ type: 'error', text: err.message || 'Payout request failed.' });
    } finally {
      setIsRequestingPayout(false);
    }
  };

  // Metrics
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const activeJobs = safeJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const readyPickupCount = safeJobs.filter((j) => j.status === 'READY_FOR_PICKUP').length;
  const pendingJobsNaira = activeJobs.reduce((sum, j) => sum + (j.finalAmount || j.originalQuoteAmount || 0), 0);
  const clearedEarningsNaira = technicianProfile?.totalEarningsNaira || 1240000;

  return (
    <div id="technician-dashboard-view" className="space-y-6 pb-8">
      {/* Top Shop Banner & Live Availability Switch */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white">
              {technicianProfile?.businessName || user?.name || 'Technician Portal'}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Verified Shop
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{technicianProfile?.shopLocation?.address || 'Port Harcourt Hub, Rivers State'}</span>
          </p>
        </div>

        {/* Live Availability Status Switch */}
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Status:</span>
          {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
            <button
              key={st}
              id={`tech-avail-btn-${st.toLowerCase()}`}
              onClick={() => handleToggleAvailability(st)}
              disabled={isUpdatingAvail}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                availability === st
                  ? st === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : st === 'BUSY'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Incoming Requests</span>
          <span className="text-2xl font-black text-blue-600">{requests.length}</span>
          <span className="text-[11px] text-slate-500 block">Open for quoting</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Quotes</span>
          <span className="text-2xl font-black text-cyan-600">{myQuotes.length}</span>
          <span className="text-[11px] text-slate-500 block">
            {myQuotes.filter((q) => q.status === 'ACCEPTED').length} accepted
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active in Shop</span>
          <span className="text-2xl font-black text-indigo-600">{activeJobs.length}</span>
          <span className="text-[11px] text-slate-500 block">{readyPickupCount} ready for pickup</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Held Repair Earnings</span>
          <span className="text-xl font-black text-emerald-700">₦{(financials.heldEarningsNaira || 0).toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 font-medium block">Held pending customer pickup</span>
        </div>
      </div>

      {/* Navigation Tabs for Technician */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          id="tab-leads-btn"
          onClick={() => setActiveTab('LEADS')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'LEADS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          Customer Leads ({requests.length})
        </button>
        <button
          id="tab-my-quotes-btn"
          onClick={() => setActiveTab('MY_QUOTES')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'MY_QUOTES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          My Quotes ({myQuotes.length})
        </button>
        <button
          id="tab-work-orders-btn"
          onClick={() => setActiveTab('WORK_ORDERS')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'WORK_ORDERS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          Active Work Orders ({activeJobs.length})
        </button>
        <button
          id="tab-finances-btn"
          onClick={() => setActiveTab('FINANCES')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'FINANCES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          Earnings & Payouts
        </button>
      </div>

      {/* TAB 1: Incoming Customer Leads */}
      {activeTab === 'LEADS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>Nearby Customer Repair Requests</span>
            </h3>
            <span className="text-xs text-blue-600 font-bold">{requests.length} Active Leads</span>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
              No open repair requests in your area right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  id={`request-lead-${req.id}`}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">
                        {req.deviceBrand} {req.deviceModel}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customer in: <strong>{req.customerLocation?.address || req.customerLocation?.area || req.customerLocation?.city || 'Local Area'}</strong>
                        {(req as any).estimatedDistanceKm !== undefined ? ` (~${(req as any).estimatedDistanceKm} km away)` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      {req.quotes?.length ?? req.quotesCount ?? 0} Quote(s)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(req.issues || []).map((iss, i) => (
                      <span key={i} className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium">
                        {(iss || '').replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>

                  {req.description && (
                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                      "{req.description}"
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      id={`inspect-btn-${req.id}`}
                      onClick={() => setInspectingRequest(req)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Inspect Details</span>
                    </button>
                    <button
                      id={`quote-btn-${req.id}`}
                      onClick={() => setSelectedRequestForQuote(req)}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Prepare Quote</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: My Submitted Quotes */}
      {activeTab === 'MY_QUOTES' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Quotes You Have Submitted</span>
            </h3>
            <span className="text-xs text-slate-500">{myQuotes.length} Total</span>
          </div>

          {myQuotes.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
              You haven't submitted any quotes yet. Browse Customer Leads to prepare and submit quotes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myQuotes.map((q) => {
                const req = q.request;
                const isPendingOrSubmitted = q.status === 'PENDING' || q.status === 'SUBMITTED' || q.status === 'VIEWED';
                return (
                  <div
                    key={q.id}
                    id={`my-quote-card-${q.id}`}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {req ? `${req.deviceBrand} ${req.deviceModel}` : `Request ID: ${q.requestId}`}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted: {new Date(q.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          q.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : q.status === 'WITHDRAWN'
                            ? 'bg-slate-100 text-slate-600'
                            : q.status === 'EXPIRED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    {/* Breakdown */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Parts ({((q.partsQuality as any) || 'STANDARD_AFTERMARKET').replace(/_/g, ' ')}):</span>
                        <span className="font-semibold text-slate-800">₦{(q.partsCost || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Labor & Diagnostics:</span>
                        <span className="font-semibold text-slate-800">₦{(q.laborCost || 0).toLocaleString()}</span>
                      </div>
                      {q.diagnosticCost > 0 && (
                        <div className="flex justify-between">
                          <span>Diagnostic Fee:</span>
                          <span className="font-semibold text-slate-800">₦{(q.diagnosticCost).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                        <span>Total Quoted:</span>
                        <span className="text-blue-700 text-sm">₦{q.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Warranty: {q.warrantyDays} days</span>
                      <span>Turnaround: {q.estimatedTimeHours} hrs</span>
                    </div>

                    {/* Withdrawal button if still open */}
                    {isPendingOrSubmitted && (
                      <button
                        id={`withdraw-quote-btn-${q.id}`}
                        onClick={() => handleWithdrawQuote(q.id)}
                        className="w-full py-2 px-3 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Withdraw Quote</span>
                      </button>
                    )}

                    {q.status === 'ACCEPTED' && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                        <span className="font-bold">Quote Accepted by Customer</span>
                        <button
                          onClick={() => setActiveTab('WORK_ORDERS')}
                          className="text-[11px] font-bold text-emerald-900 underline cursor-pointer"
                        >
                          View Work Order
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Active Work Orders In Shop */}
      {activeTab === 'WORK_ORDERS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <span>Active Work Orders in Shop</span>
            </h3>
            <span className="text-xs text-slate-500">{activeJobs.length} In Progress</span>
          </div>

          {activeJobs.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
              No active work orders. When a customer accepts your quote and creates a booking, it will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <div
                  key={job.id}
                  id={`job-row-${job.id}`}
                  onClick={() => onOpenJob(job.id)}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-base text-slate-900">{job.deviceBrand} {job.deviceModel}</h4>
                      <StatusBadge status={job.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Ref: <span className="font-mono text-slate-700 font-bold">{job.bookingRef || job.id}</span> • Amount: <strong className="text-emerald-700">₦{(job.finalAmount || job.originalQuoteAmount || 0).toLocaleString()}</strong>
                    </p>
                  </div>

                  <button className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer">
                    <span>Open Job Workspace</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Finances & Payouts */}
      {activeTab === 'FINANCES' && (
        <div id="technician-finances-tab" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Held by Fixhub</span>
              <span className="text-2xl font-black text-amber-600">₦{financials.heldEarningsNaira.toLocaleString()}</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Active repair earnings held securely until customer tests and completes physical pickup.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Eligible for Payout</span>
              <span className="text-2xl font-black text-emerald-600">₦{financials.availablePayoutNaira.toLocaleString()}</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Available balance cleared from completed repairs ready for bank withdrawal.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Completed Payouts</span>
              <span className="text-2xl font-black text-slate-900">₦{financials.totalCompletedPayoutsNaira.toLocaleString()}</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Settled withdrawals to your bank. Fixhub platform fee: {financials.commissionRatePercent}%.
              </p>
            </div>
          </div>

          {/* Payout Request Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Payout</h3>
                <p className="text-xs text-slate-500">Withdraw available eligible earnings directly to your verified bank account.</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                Eligible Balance: ₦{financials.availablePayoutNaira.toLocaleString()}
              </span>
            </div>

            {payoutMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                payoutMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {payoutMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={payoutBank}
                  onChange={(e) => setPayoutBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={payoutAccountNum}
                  onChange={(e) => setPayoutAccountNum(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₦)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={payoutAmountInput}
                    onChange={(e) => setPayoutAmountInput(e.target.value)}
                    placeholder={`Max: ${financials.availablePayoutNaira}`}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-800"
                  />
                  <button
                    id="submit-payout-btn"
                    onClick={handleRequestPayout}
                    disabled={isRequestingPayout || financials.availablePayoutNaira <= 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isRequestingPayout ? 'Submitting...' : 'Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Repair Earnings Ledger</h4>
              <span className="text-xs text-slate-500 font-medium">Authoritative Server Ledger</span>
            </div>
            {earningsList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No repair earnings recorded yet. Accept customer quotes to generate earnings.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Repair ID</th>
                      <th className="p-3">Customer Paid</th>
                      <th className="p-3">Platform Fee ({financials.commissionRatePercent}%)</th>
                      <th className="p-3">Net Earnings</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Recorded Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {earningsList.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-800">{e.repairId}</td>
                        <td className="p-3 font-semibold text-slate-900">₦{e.grossAmountNaira.toLocaleString()}</td>
                        <td className="p-3 text-slate-500">-₦{e.platformFeeNaira.toLocaleString()}</td>
                        <td className="p-3 font-bold text-emerald-700">₦{e.netEarningsNaira.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            e.status === 'HELD'
                              ? 'bg-amber-100 text-amber-800'
                              : e.status === 'ELIGIBLE_FOR_PAYOUT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : e.status === 'PAID_OUT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {e.status === 'HELD' ? 'Held by Fixhub' : e.status === 'ELIGIBLE_FOR_PAYOUT' ? 'Eligible for Payout' : e.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payouts History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Withdrawal & Payout History</h4>
              <span className="text-xs text-slate-500 font-semibold">{payoutList.length} records</span>
            </div>
            {payoutList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No bank withdrawal requests yet. Payouts initiated above will appear here with live settlement status.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Payout ID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Destination Account</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Requested At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payoutList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-800">{p.id}</td>
                        <td className="p-3 font-bold text-slate-900">₦{p.amountNaira.toLocaleString()}</td>
                        <td className="p-3 text-slate-600">
                          {p.destinationAccount?.bankName} ({p.destinationAccount?.accountNumber})
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              p.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'FAILED' || p.status === 'REVERSED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Inspection Modal */}
      {inspectingRequest && (
        <RequestInspectionModal
          request={inspectingRequest}
          onClose={() => setInspectingRequest(null)}
          onOpenQuoteBuilder={() => {
            const r = inspectingRequest;
            setInspectingRequest(null);
            setSelectedRequestForQuote(r);
          }}
        />
      )}

      {/* Quote Builder Modal */}
      {selectedRequestForQuote && (
        <QuoteBuilderModal
          request={selectedRequestForQuote}
          onClose={() => setSelectedRequestForQuote(null)}
          onQuoteSubmitted={() => {
            setSelectedRequestForQuote(null);
            fetchDashboardData();
            setActiveTab('MY_QUOTES');
            setActionMsg('Your quote has been submitted successfully to the customer.');
            setTimeout(() => setActionMsg(null), 4000);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

