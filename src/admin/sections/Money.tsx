import React, { useState } from 'react';
import { AdminApi } from '../../api/adminClient';
import { Badge, Btn, Column, ConfirmDialog, ConfirmSpec, DataList, Drawer, Card, Dt, ErrorBox, KV, Spinner, useAdmin, useDetail } from '../ui';
import { labelize } from '../../utils/adminUi';
import { formatNaira } from '../../utils/format';
import { JobDrawer } from './Operations';

const PAY_STATUSES = ['INITIATED', 'PENDING', 'SUCCESS', 'ESCROW_HELD', 'RELEASED_TO_TECHNICIAN', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'FAILED', 'CANCELLED'];

interface PaymentRow { id: string; repairId: string; transactionRef: string; status: string; amountNaira: number; platformFeeNaira: number; refundedAmountNaira?: number; customerName: string; technicianName: string; createdAt?: string; paymentMethod: string }

export const PaymentsSection: React.FC = () => {
  const { toast } = useAdmin();
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const detail = useDetail<{ payment: PaymentRow & { providerReference?: string; paidAt?: string; releasedAt?: string; failureReason?: string; technicianPayoutNaira: number }; refunds: { id: string; amountNaira: number; status: string; reason: string; createdAt: string }[] }>(openId ? `/payments/${encodeURIComponent(openId)}` : null);
  const p = detail.data?.payment;

  const refund = () => setConfirm({
    title: 'Issue a refund', danger: true, confirmLabel: 'Refund customer', needsReason: true,
    description: <>Refundable balance: <b>{formatNaira((p?.amountNaira || 0) - (p?.refundedAmountNaira || 0))}</b>. Leave the amount empty for a full refund. The refund is sent to Paystack.</>,
    fields: [{ key: 'amount', label: 'Amount in ₦ (optional)', type: 'number', placeholder: 'Full refund' }],
    run: async (v) => { await AdminApi.post(`/payments/${p!.id}/refund`, { amountNaira: v.fields.amount || undefined, reason: v.reason, adminPassword: v.adminPassword }); toast('Refund issued'); detail.reload(); setRefresh((r) => r + 1); },
  });
  const reconcile = () => setConfirm({
    title: 'Reconcile pending payments', confirmLabel: 'Run reconciliation', description: 'Asks Paystack for the real status of payments that are still pending (missed webhooks, closed tabs).',
    run: async (v) => { const r: any = await AdminApi.post('/payments/reconcile', { adminPassword: v.adminPassword }); toast(`Checked ${r.checkedCount}, reconciled ${r.reconciledCount}, failed ${r.failedCount}`); setRefresh((n) => n + 1); },
  });

  const cols: Column<PaymentRow>[] = [
    { key: 'ref', header: 'Reference', render: (r) => <div><div className="font-semibold text-slate-900">{r.transactionRef}</div><div className="text-xs text-slate-500">{r.customerName} → {r.technicianName}</div></div> },
    { key: 'status', header: 'Status', sort: 'status', render: (r) => <Badge value={r.status} /> },
    { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: (r) => formatNaira(r.amountNaira) },
    { key: 'fee', header: 'Fee', align: 'right', render: (r) => formatNaira(r.platformFeeNaira) },
    { key: 'created', header: 'Created', sort: 'createdAt', render: (r) => <Dt value={r.createdAt} /> },
  ];
  return (
    <>
      <DataList<PaymentRow>
        path="/payments" columns={cols} exportLedger="payments" onRowClick={(r) => setOpenId(r.id)} refreshKey={refresh}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: PAY_STATUSES.map((s) => ({ value: s, label: labelize(s) })) }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        searchPlaceholder="Search reference, customer, technician, job…" defaultSort={{ sort: 'createdAt', order: 'desc' }} emptyTitle="No payments yet"
        toolbar={<Btn onClick={reconcile}>Reconcile pending</Btn>}
      />
      <Drawer open={Boolean(openId)} onClose={() => setOpenId(null)} title={p ? formatNaira(p.amountNaira) : 'Payment'} subtitle={p?.transactionRef}>
        {detail.loading && !p && <Spinner />}
        {detail.error && <ErrorBox message={detail.error} onRetry={detail.reload} />}
        {p && (
          <>
            <div className="flex items-center gap-2"><Badge value={p.status} /><Badge tone="slate" label={labelize(p.paymentMethod)} /></div>
            <Card title="Breakdown"><dl className="divide-y divide-slate-100">
              <KV label="Customer">{p.customerName}</KV><KV label="Technician">{p.technicianName}</KV>
              <KV label="Amount">{formatNaira(p.amountNaira)}</KV><KV label="Platform fee">{formatNaira(p.platformFeeNaira)}</KV><KV label="Technician payout">{formatNaira(p.technicianPayoutNaira)}</KV>
              <KV label="Refunded">{formatNaira(p.refundedAmountNaira || 0)}</KV>
              <KV label="Paid"><Dt value={p.paidAt} /></KV><KV label="Released"><Dt value={p.releasedAt} /></KV>
              {p.failureReason && <KV label="Failure">{p.failureReason}</KV>}
              <KV label="Job"><button className="text-blue-600 underline" onClick={() => setJobId(p.repairId)}>{p.repairId}</button></KV>
            </dl></Card>
            <Card title={`Refunds (${detail.data!.refunds.length})`}>
              {detail.data!.refunds.length === 0 ? <p className="text-sm text-slate-500">No refunds.</p> : <ul className="divide-y divide-slate-100 text-sm">{detail.data!.refunds.map((r) => <li key={r.id} className="py-2"><div className="flex justify-between"><span>{formatNaira(r.amountNaira)} <Badge value={r.status} /></span><Dt value={r.createdAt} /></div><div className="text-xs text-slate-500">{r.reason}</div></li>)}</ul>}
            </Card>
            {['SUCCESS', 'ESCROW_HELD'].includes(p.status) && (p.amountNaira - (p.refundedAmountNaira || 0)) > 0 && (
              <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-slate-200 bg-white p-3"><Btn variant="danger" onClick={refund}>Refund…</Btn></div>
            )}
          </>
        )}
      </Drawer>
      <JobDrawer id={jobId} onClose={() => setJobId(null)} onChanged={() => setRefresh((r) => r + 1)} />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

interface EarnRow { id: string; repairId: string; technicianName: string; grossAmountNaira: number; platformFeeNaira: number; netEarningsNaira: number; status: string; createdAt: string }
export const EscrowSection: React.FC = () => {
  const cols: Column<EarnRow>[] = [
    { key: 'tech', header: 'Technician', render: (r) => <div><div className="font-semibold text-slate-900">{r.technicianName}</div><div className="text-xs text-slate-500">Job {r.repairId}</div></div> },
    { key: 'status', header: 'Status', sort: 'status', render: (r) => <Badge value={r.status} /> },
    { key: 'gross', header: 'Gross', sort: 'amount', align: 'right', render: (r) => formatNaira(r.grossAmountNaira) },
    { key: 'fee', header: 'Fee', align: 'right', render: (r) => formatNaira(r.platformFeeNaira) },
    { key: 'net', header: 'Net to technician', align: 'right', render: (r) => formatNaira(r.netEarningsNaira) },
    { key: 'created', header: 'Created', sort: 'createdAt', render: (r) => <Dt value={r.createdAt} /> },
  ];
  return <DataList<EarnRow> path="/escrow" columns={cols} exportLedger="earnings" searchPlaceholder="Search technician, job or payment…" defaultSort={{ sort: 'createdAt', order: 'desc' }} emptyTitle="No earnings recorded yet"
    filters={[{ key: 'status', label: 'Status', type: 'select', options: ['HELD', 'ELIGIBLE_FOR_PAYOUT', 'PAYOUT_INITIATED', 'PAID_OUT', 'REVERSED', 'REFUNDED'].map((s) => ({ value: s, label: labelize(s) })) }]} />;
};

interface RefundRow { id: string; paymentId: string; repairId: string; customerName: string; amountNaira: number; status: string; reason: string; createdAt: string }
export const RefundsSection: React.FC = () => {
  const cols: Column<RefundRow>[] = [
    { key: 'customer', header: 'Refund', render: (r) => <div><div className="font-semibold text-slate-900">{r.customerName}</div><div className="max-w-xs truncate text-xs text-slate-500">{r.reason}</div></div> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: (r) => formatNaira(r.amountNaira) },
    { key: 'created', header: 'Created', sort: 'createdAt', render: (r) => <Dt value={r.createdAt} /> },
  ];
  return <DataList<RefundRow> path="/refunds" columns={cols} exportLedger="refunds" searchPlaceholder="Search customer, reason, payment, job…" defaultSort={{ sort: 'createdAt', order: 'desc' }} emptyTitle="No refunds"
    filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING', 'COMPLETED', 'REJECTED', 'FAILED'].map((s) => ({ value: s, label: labelize(s) })) }]} />;
};

interface PayoutRow { id: string; technicianName: string; amountNaira: number; status: string; createdAt: string; failureReason?: string; providerReference?: string; destinationAccount?: { bankName: string; accountNumber: string; accountName: string } }
export const PayoutsSection: React.FC = () => {
  const { toast, config } = useAdmin();
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const approve = (p: PayoutRow) => setConfirm({
    title: `Approve ${formatNaira(p.amountNaira)} payout?`, confirmLabel: 'Approve & send',
    description: <>Sends the transfer to <b>{p.destinationAccount?.accountName}</b> · {p.destinationAccount?.bankName} · {p.destinationAccount?.accountNumber}. This moves real money.</>,
    run: async (v) => { await AdminApi.post(`/payouts/${p.id}/approve`, { adminPassword: v.adminPassword }); toast('Payout approved'); setRefresh((r) => r + 1); },
  });
  const reject = (p: PayoutRow) => setConfirm({
    title: 'Reject this payout?', danger: true, confirmLabel: 'Reject payout', needsReason: true, reasonLabel: 'Reason (sent to the technician)',
    description: 'Nothing is sent. The earnings stay available for the technician.',
    run: async (v) => { await AdminApi.post(`/payouts/${p.id}/reject`, { reason: v.reason, adminPassword: v.adminPassword }); toast('Payout rejected'); setRefresh((r) => r + 1); },
  });
  const cols: Column<PayoutRow>[] = [
    { key: 'tech', header: 'Technician', render: (r) => <div><div className="font-semibold text-slate-900">{r.technicianName}</div><div className="text-xs text-slate-500">{r.destinationAccount ? `${r.destinationAccount.bankName} · ${r.destinationAccount.accountNumber}` : 'No account'}</div></div> },
    { key: 'status', header: 'Status', sort: 'status', render: (r) => <div><Badge value={r.status} />{r.failureReason && <div className="mt-0.5 max-w-[14rem] truncate text-[11px] text-slate-500">{r.failureReason}</div>}</div> },
    { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: (r) => formatNaira(r.amountNaira) },
    { key: 'created', header: 'Requested', sort: 'createdAt', render: (r) => <Dt value={r.createdAt} /> },
    { key: 'actions', header: 'Actions', render: (r) => r.status === 'PENDING' ? (
      <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}><Btn small variant="primary" onClick={() => approve(r)}>Approve</Btn><Btn small onClick={() => reject(r)}>Reject</Btn></span>
    ) : <span className="text-xs text-slate-400">—</span> },
  ];
  return (
    <>
      {!config.payoutApprovalRequired && (
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Manual approval is <b>off</b>: technician payouts go to Paystack immediately. Set <code>PAYOUT_APPROVAL_REQUIRED=true</code> to review each one here first.</div>
      )}
      <DataList<PayoutRow> path="/payouts" columns={cols} exportLedger="payouts" searchPlaceholder="Search technician, bank or reference…" defaultSort={{ sort: 'createdAt', order: 'desc' }} emptyTitle="No payouts yet" refreshKey={refresh}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'].map((s) => ({ value: s, label: labelize(s) })) }]} />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};
