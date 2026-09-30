import React, { useState } from 'react';
import { AdminApi } from '../../api/adminClient';
import { Badge, Btn, Card, Column, ConfirmDialog, ConfirmSpec, DataList, Drawer, Dt, ErrorBox, KV, Spinner, useAdmin, useDetail } from '../ui';
import { labelize } from '../../utils/adminUi';
import { formatNaira } from '../../utils/format';

interface JobRow {
  id: string; bookingRef: string | null; status: string; deviceBrand: string; deviceModel: string; customerName: string; technicianName: string;
  amountNaira: number; paymentStatus: string | null; createdAt: string;
}

interface JobDetail {
  job: { id: string; status: string; issues?: string[]; statusHistory: { status: string; timestamp: string; actorRole: string; note?: string }[]; disputeReason?: string };
  summary: JobRow;
  customer: { id: string; name: string; email: string; phone: string; status: string } | null;
  technician: { userId: string; businessName: string; phone: string; rating: number; isVerified: boolean; status: string } | null;
  payments: { id: string; status: string; amountNaira: number; platformFeeNaira: number; refundedAmountNaira?: number }[];
  refunds: { id: string; amountNaira: number; status: string; reason: string }[];
  reviews: { id: string; rating: number; comment: string }[];
  messageCount: number;
  auditTrail: { id: string; action: string; timestamp: string }[];
  allowedActions: { cancel: boolean; dispute: boolean; resolveDispute: boolean };
}

export const JobDrawer: React.FC<{ id: string | null; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { toast } = useAdmin();
  const { data, loading, error, reload } = useDetail<JobDetail>(id ? `/jobs/${encodeURIComponent(id)}` : null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [messages, setMessages] = useState<{ id: string; senderName: string; senderRole: string; text: string; createdAt: string }[] | null>(null);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const done = (m: string) => { toast(m); reload(); onChanged(); };

  const force = (status: 'CANCELLED' | 'DISPUTED') => setConfirm({
    title: status === 'CANCELLED' ? 'Cancel this job?' : 'Open a dispute on this job?', danger: status === 'CANCELLED', confirmLabel: status === 'CANCELLED' ? 'Cancel job' : 'Open dispute', needsReason: true,
    description: status === 'CANCELLED' ? 'A paid job is refunded to the customer automatically and both parties are notified.' : 'Escrow stays held until you resolve the dispute.',
    run: async (v) => {
      const r: any = await AdminApi.post(`/jobs/${id}/force-status`, { status, reason: v.reason, adminPassword: v.adminPassword });
      done(status === 'CANCELLED' ? (r.refunded ? `Job cancelled and ${formatNaira(r.refundAmountNaira)} refunded` : 'Job cancelled') : 'Dispute opened');
    },
  });
  const resolve = () => setConfirm({
    title: 'Resolve dispute', confirmLabel: 'Apply decision', danger: true, needsReason: true, reasonLabel: 'Resolution notes (sent to both parties)',
    fields: [{ key: 'decision', label: 'Decision', type: 'select', defaultValue: 'REFUND_CUSTOMER', options: [
      { value: 'REFUND_CUSTOMER', label: 'Refund the customer (cancels the job)' },
      { value: 'RELEASE_TECHNICIAN', label: 'Release payment to the technician (completes the job)' },
      { value: 'RETURN_TO_REPAIR', label: 'Send back to repair (no money moves)' },
    ] }],
    run: async (v) => { await AdminApi.post(`/disputes/${id}/resolve`, { decision: v.fields.decision, resolutionNotes: v.reason, adminPassword: v.adminPassword }); done('Dispute resolved'); },
  });
  const loadMessages = async () => {
    setMsgErr(null);
    try { setMessages(await AdminApi.get(`/jobs/${id}/messages`)); } catch (e: any) { setMsgErr(e.message); }
  };

  const d = data;
  return (
    <>
      <Drawer open={Boolean(id)} onClose={() => { setMessages(null); onClose(); }} title={d ? `${d.summary.deviceBrand} ${d.summary.deviceModel}` : 'Repair job'} subtitle={d ? `${d.summary.bookingRef || d.job.id}` : undefined} width="max-w-2xl">
        {loading && !d && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {d && (
          <>
            <div className="flex flex-wrap items-center gap-2"><Badge value={d.job.status} />{d.summary.paymentStatus && <Badge value={d.summary.paymentStatus} label={`Payment: ${labelize(d.summary.paymentStatus)}`} />}<span className="text-sm font-bold tabular-nums">{formatNaira(d.summary.amountNaira)}</span></div>
            {d.job.disputeReason && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><b>Dispute:</b> {d.job.disputeReason}</div>}
            <Card title="People">
              <dl className="divide-y divide-slate-100">
                <KV label="Customer">{d.customer ? `${d.customer.name} · ${d.customer.phone || d.customer.email}` : '—'}</KV>
                <KV label="Technician">{d.technician ? `${d.technician.businessName} · ${d.technician.phone || ''}` : '—'}</KV>
                <KV label="Issues">{(d.job.issues || []).map(labelize).join(', ') || '—'}</KV>
                <KV label="Created"><Dt value={d.summary.createdAt} /></KV>
              </dl>
            </Card>
            <Card title="Status timeline">
              <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
                {d.job.statusHistory.map((h, i) => (
                  <li key={i} className="text-sm"><span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-2"><b>{labelize(h.status)}</b><span className="text-xs text-slate-500"><Dt value={h.timestamp} /> · {h.actorRole}</span></div>
                    {h.note && <div className="text-xs text-slate-600">{h.note}</div>}
                  </li>
                ))}
              </ol>
            </Card>
            <Card title={`Payments (${d.payments.length}) & refunds (${d.refunds.length})`}>
              {d.payments.length === 0 ? <p className="text-sm text-slate-500">No payment yet.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {d.payments.map((p) => <li key={p.id} className="flex items-center justify-between py-2"><span className="flex items-center gap-2"><Badge value={p.status} /> fee {formatNaira(p.platformFeeNaira)}</span><span className="tabular-nums">{formatNaira(p.amountNaira)}{p.refundedAmountNaira ? ` (−${formatNaira(p.refundedAmountNaira)})` : ''}</span></li>)}
                  {d.refunds.map((r) => <li key={r.id} className="py-2 text-xs text-slate-600">Refund {formatNaira(r.amountNaira)} · {labelize(r.status)} · {r.reason}</li>)}
                </ul>
              )}
            </Card>
            <Card title={`Chat (${d.messageCount})`} action={messages === null && d.messageCount > 0 ? <Btn small onClick={loadMessages}>Read transcript</Btn> : undefined}>
              {msgErr && <ErrorBox message={msgErr} />}
              {messages === null ? <p className="text-xs text-slate-500">Private. Opening the transcript is recorded in the audit log.</p> : messages.length === 0 ? <p className="text-sm text-slate-500">No messages.</p> : (
                <ul className="space-y-2 text-sm">{messages.map((m) => <li key={m.id}><span className="font-semibold">{m.senderName}</span> <span className="text-xs text-slate-400">({m.senderRole}, <Dt value={m.createdAt} />)</span><div className="text-slate-700">{m.text}</div></li>)}</ul>
              )}
            </Card>
            <Card title="Audit trail">
              {d.auditTrail.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded.</p> : <ul className="divide-y divide-slate-100 text-xs">{d.auditTrail.slice(0, 12).map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{labelize(a.action)}</span><Dt value={a.timestamp} /></li>)}</ul>}
            </Card>
            {(d.allowedActions.cancel || d.allowedActions.dispute || d.allowedActions.resolveDispute) && (
              <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white p-3">
                {d.allowedActions.resolveDispute && <Btn variant="primary" onClick={resolve}>Resolve dispute</Btn>}
                {d.allowedActions.dispute && <Btn onClick={() => force('DISPUTED')}>Open dispute</Btn>}
                {d.allowedActions.cancel && <Btn variant="danger" onClick={() => force('CANCELLED')}>Cancel job</Btn>}
              </div>
            )}
          </>
        )}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

const JOB_STATUSES = ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'BOOKED', 'DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'READY_FOR_PICKUP', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'];

export const JobsSection: React.FC<{ disputesOnly?: boolean }> = ({ disputesOnly }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const cols: Column<JobRow>[] = [
    { key: 'job', header: 'Job', render: (j) => <div><div className="font-semibold text-slate-900">{j.deviceBrand} {j.deviceModel}</div><div className="text-xs text-slate-500">{j.bookingRef || j.id}</div></div> },
    { key: 'customer', header: 'Customer', render: (j) => j.customerName },
    { key: 'tech', header: 'Technician', render: (j) => j.technicianName },
    { key: 'status', header: 'Status', sort: 'status', render: (j) => <Badge value={j.status} /> },
    { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: (j) => formatNaira(j.amountNaira) },
    { key: 'created', header: 'Created', sort: 'createdAt', render: (j) => <Dt value={j.createdAt} /> },
  ];
  return (
    <>
      <DataList<JobRow>
        key={disputesOnly ? 'disputes' : 'jobs'}
        path="/jobs"
        columns={cols}
        initialFilters={disputesOnly ? { status: 'DISPUTED' } : {}}
        filters={disputesOnly ? [] : [{ key: 'status', label: 'Status', type: 'select', options: JOB_STATUSES.map((s) => ({ value: s, label: labelize(s) })) }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        searchPlaceholder="Search job, customer, technician, device…"
        exportLedger={disputesOnly ? undefined : 'jobs'}
        onRowClick={(j) => setOpenId(j.id)}
        defaultSort={{ sort: 'createdAt', order: 'desc' }}
        refreshKey={refresh}
        emptyTitle={disputesOnly ? 'No open disputes 🎉' : 'No repair jobs yet'}
      />
      <JobDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => setRefresh((r) => r + 1)} />
    </>
  );
};
