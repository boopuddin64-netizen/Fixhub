import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { AdminApi } from '../../api/adminClient';
import { Badge, Btn, Card, Column, ConfirmDialog, ConfirmSpec, DataList, Dt, useAdmin } from '../ui';
import { describeAuditAction, labelize } from '../../utils/adminUi';
import { validateAdminPassword } from '../../utils/adminPasswordPolicy';
import { formatCount } from '../../utils/format';

/* ------------------------------------------------------------------ reviews */

interface ReviewRow { id: string; rating: number; comment: string; customerName: string; technicianName: string; hidden?: boolean; hiddenReason?: string; createdAt: string }

export const ReviewsSection: React.FC = () => {
  const { toast } = useAdmin();
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const ok = (m: string) => { toast(m); setRefresh((r) => r + 1); };
  const hide = (r: ReviewRow) => setConfirm({
    title: 'Hide this review?', confirmLabel: 'Hide review', needsReason: true, description: 'It disappears from the technician page and no longer counts towards their rating. It can be restored later.',
    run: async (v) => { await AdminApi.post(`/reviews/${r.id}/hide`, { reason: v.reason, adminPassword: v.adminPassword }); ok('Review hidden'); },
  });
  const unhide = (r: ReviewRow) => setConfirm({
    title: 'Restore this review?', confirmLabel: 'Restore', needsPassword: false, needsReason: true, reasonOptional: true, reasonLabel: 'Note',
    run: async (v) => { await AdminApi.post(`/reviews/${r.id}/unhide`, { reason: v.reason }); ok('Review restored'); },
  });
  const remove = (r: ReviewRow) => setConfirm({
    title: 'Permanently delete this review?', danger: true, confirmLabel: 'Delete permanently', needsReason: true, description: 'This cannot be undone (a snapshot is kept in the audit log). Prefer “Hide” unless the review is abusive or illegal.',
    run: async (v) => { await AdminApi.del(`/reviews/${r.id}`, { reason: v.reason, adminPassword: v.adminPassword }); ok('Review deleted'); },
  });
  const cols: Column<ReviewRow>[] = [
    { key: 'rating', header: 'Rating', sort: 'rating', render: (r) => <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{r.rating}</span> },
    { key: 'comment', header: 'Review', render: (r) => <div className="max-w-md"><div className="line-clamp-2 text-slate-800">{r.comment || <em className="text-slate-400">No comment</em>}</div><div className="text-xs text-slate-500">{r.customerName} → {r.technicianName}</div>{r.hidden && <div className="text-xs text-rose-600">Hidden: {r.hiddenReason}</div>}</div> },
    { key: 'state', header: 'State', render: (r) => r.hidden ? <Badge tone="red" label="Hidden" /> : <Badge tone="green" label="Visible" /> },
    { key: 'created', header: 'Posted', sort: 'createdAt', render: (r) => <Dt value={r.createdAt} /> },
    { key: 'actions', header: 'Actions', render: (r) => (
      <span className="flex gap-1.5">{r.hidden ? <Btn small onClick={() => unhide(r)}>Restore</Btn> : <Btn small onClick={() => hide(r)}>Hide</Btn>}<Btn small variant="danger" onClick={() => remove(r)}>Delete</Btn></span>
    ) },
  ];
  return (
    <>
      <DataList<ReviewRow> path="/reviews" columns={cols} refreshKey={refresh} searchPlaceholder="Search comment, customer, technician…" defaultSort={{ sort: 'createdAt', order: 'desc' }} emptyTitle="No reviews yet"
        filters={[{ key: 'hidden', label: 'Visibility', type: 'select', options: [{ value: 'false', label: 'Visible' }, { value: 'true', label: 'Hidden' }] }, { key: 'rating', label: 'Rating', type: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` })) }]} />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

/* ------------------------------------------------------------------ risk events */

interface RiskRow { id: string; eventType: string; severity: string; actorId: string; actorName: string | null; reviewed: boolean; timestamp: string; reviewNote?: string; metadata: Record<string, unknown> }

export const RiskSection: React.FC = () => {
  const { toast } = useAdmin();
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const review = (r: RiskRow) => setConfirm({
    title: 'Mark as reviewed', confirmLabel: 'Mark reviewed', needsPassword: false, needsReason: true, reasonOptional: true, reasonLabel: 'Review note',
    description: <code className="text-xs break-all">{JSON.stringify(r.metadata).slice(0, 300)}</code>,
    run: async (v) => { await AdminApi.post(`/risk-events/${r.id}/review`, { note: v.reason }); toast('Marked as reviewed'); setRefresh((n) => n + 1); },
  });
  const cols: Column<RiskRow>[] = [
    { key: 'event', header: 'Event', render: (r) => <div><div className="font-semibold text-slate-900">{labelize(r.eventType)}</div><div className="text-xs text-slate-500">{r.actorName || r.actorId}</div></div> },
    { key: 'sev', header: 'Severity', sort: 'severity', render: (r) => <Badge value={r.severity} /> },
    { key: 'time', header: 'When', sort: 'timestamp', render: (r) => <Dt value={r.timestamp} /> },
    { key: 'state', header: 'Review', render: (r) => r.reviewed ? <span className="text-xs text-slate-500">Reviewed{r.reviewNote ? `: ${r.reviewNote}` : ''}</span> : <Btn small onClick={() => review(r)}>Review</Btn> },
  ];
  return (
    <>
      <DataList<RiskRow> path="/risk-events" columns={cols} refreshKey={refresh} searchPlaceholder="Search event type or user…" defaultSort={{ sort: 'timestamp', order: 'desc' }} emptyTitle="No risk events recorded" initialFilters={{ reviewed: 'false' }}
        filters={[{ key: 'reviewed', label: 'Review', type: 'select', options: [{ value: 'false', label: 'Unreviewed' }, { value: 'true', label: 'Reviewed' }] }, { key: 'severity', label: 'Severity', type: 'select', options: ['HIGH', 'MEDIUM', 'LOW'].map((s) => ({ value: s, label: labelize(s) })) }]} />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

/* ------------------------------------------------------------------ audit log */

interface AuditRow { id: string; timestamp: string; actorId: string; actorName: string | null; actorRole: string; action: string; resourceType: string; resourceId: string; ipAddress?: string; details: Record<string, unknown> }

export const AuditSection: React.FC = () => {
  const [open, setOpen] = useState<string | null>(null);
  const cols: Column<AuditRow>[] = [
    { key: 'time', header: 'Time', sort: 'timestamp', render: (a) => <Dt value={a.timestamp} /> },
    { key: 'action', header: 'Action', sort: 'action', render: (a) => <div><div className="font-semibold text-slate-900">{describeAuditAction(a.action)}</div><div className="text-xs text-slate-500">{labelize(a.resourceType)} · {a.resourceId}</div></div> },
    { key: 'actor', header: 'Actor', render: (a) => <div>{a.actorName || a.actorId}<div className="text-xs text-slate-500">{a.actorRole}{a.ipAddress ? ` · ${a.ipAddress}` : ''}</div></div> },
    { key: 'details', header: 'Details', render: (a) => (
      <div className="max-w-sm">
        <button className="text-xs text-blue-600 underline" onClick={(e) => { e.stopPropagation(); setOpen(open === a.id ? null : a.id); }}>{open === a.id ? 'Hide' : 'Show'}</button>
        {open === a.id && <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">{JSON.stringify(a.details, null, 2)}</pre>}
      </div>
    ) },
  ];
  return <DataList<AuditRow> path="/audit-logs" columns={cols} exportLedger="audit-logs" searchPlaceholder="Search action, actor, resource, details…" defaultSort={{ sort: 'timestamp', order: 'desc' }} emptyTitle="No audit entries"
    filters={[{ key: 'resourceType', label: 'Resource', type: 'select', options: ['USER', 'TECHNICIAN', 'REPAIR_JOB', 'PAYMENT', 'PAYOUT', 'REVIEW', 'RISK_EVENT', 'ANNOUNCEMENT', 'EXPORT'].map((s) => ({ value: s, label: labelize(s) })) }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]} />;
};

/* ------------------------------------------------------------------ announcements */

interface AnnRow { id: string; sentAt: string; sentByName: string | null; title: string; message: string; audience: string; recipients: number }

export const AnnouncementsSection: React.FC = () => {
  const { toast } = useAdmin();
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const cols: Column<AnnRow>[] = [
    { key: 'title', header: 'Announcement', render: (a) => <div className="max-w-md"><div className="font-semibold text-slate-900">{a.title}</div><div className="line-clamp-2 text-xs text-slate-500">{a.message}</div></div> },
    { key: 'aud', header: 'Audience', render: (a) => <Badge tone="blue" label={labelize(a.audience)} /> },
    { key: 'rec', header: 'Recipients', align: 'right', render: (a) => formatCount(a.recipients) },
    { key: 'sent', header: 'Sent', render: (a) => <div><Dt value={a.sentAt} /><div className="text-xs text-slate-500">{a.sentByName}</div></div> },
  ];
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) return setError('Enter a title (at least 3 characters).');
    if (message.trim().length < 5) return setError('Enter a message (at least 5 characters).');
    setError(null);
    setConfirm({
      title: 'Send this announcement?', confirmLabel: 'Send to users',
      description: <>It appears in the notification centre of every <b>{audience === 'all' ? 'customer and technician' : audience.replace(/s$/, '')}</b>. This cannot be recalled.</>,
      run: async (v) => {
        const r: any = await AdminApi.post('/announcements', { title, message, audience, adminPassword: v.adminPassword });
        toast(`Sent to ${r.recipients} user(s)`); setTitle(''); setMessage(''); setRefresh((n) => n + 1);
      },
    });
  };
  const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
  return (
    <div className="space-y-4">
      <Card title="New announcement">
        <form onSubmit={send} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Title</span><input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Scheduled maintenance tonight" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Audience</span>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}><option value="all">Everyone</option><option value="customers">Customers</option><option value="technicians">Technicians</option></select></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Message <span className="font-normal text-slate-400">({message.length}/500)</span></span><textarea value={message} maxLength={500} rows={3} onChange={(e) => setMessage(e.target.value)} className={inputCls} /></label>
          {error && <div role="alert" className="text-sm text-rose-700">{error}</div>}
          <Btn type="submit" variant="primary">Review & send…</Btn>
        </form>
      </Card>
      <DataList<AnnRow> path="/announcements" columns={cols} refreshKey={refresh} searchPlaceholder="Search…" emptyTitle="No announcements sent yet" />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

/* ------------------------------------------------------------------ admins & security */

interface AdminRow { id: string; name: string; email: string; status: string; lastLoginAt: string | null; mustChangePassword: boolean; isYou: boolean; createdAt: string }

export const AdminsSection: React.FC = () => {
  const { toast, me, config, signOut } = useAdmin();
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const cols: Column<AdminRow>[] = [
    { key: 'name', header: 'Admin', render: (a) => <div><div className="font-semibold text-slate-900">{a.name}{a.isYou && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</div><div className="text-xs text-slate-500">{a.email}</div></div> },
    { key: 'status', header: 'Status', render: (a) => <span className="flex gap-1"><Badge value={a.status} />{a.mustChangePassword && <Badge tone="amber" label="Must change password" />}</span> },
    { key: 'login', header: 'Last login', render: (a) => <Dt value={a.lastLoginAt} /> },
    { key: 'actions', header: 'Actions', render: (a) => a.isYou ? <span className="text-xs text-slate-400">—</span> : (
      <span className="flex gap-1.5">
        <Btn small onClick={() => setConfirm({ title: `Sign ${a.name} out everywhere?`, confirmLabel: 'Revoke sessions', danger: true, run: async (v) => { await AdminApi.post(`/users/${a.id}/revoke-sessions`, { adminPassword: v.adminPassword }); toast('Sessions revoked'); } })}>Revoke sessions</Btn>
        {a.status === 'suspended'
          ? <Btn small onClick={() => setConfirm({ title: `Reactivate ${a.name}?`, confirmLabel: 'Reactivate', needsPassword: false, run: async () => { await AdminApi.post(`/users/${a.id}/reactivate`, {}); toast('Admin reactivated'); setRefresh((n) => n + 1); } })}>Reactivate</Btn>
          : <Btn small variant="danger" onClick={() => setConfirm({ title: `Suspend admin ${a.name}?`, confirmLabel: 'Suspend', danger: true, needsReason: true, run: async (v) => { await AdminApi.post(`/users/${a.id}/suspend`, { reason: v.reason, adminPassword: v.adminPassword }); toast('Admin suspended'); setRefresh((n) => n + 1); } })}>Suspend</Btn>}
      </span>
    ) },
  ];

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateAdminPassword(next, { email: me.email, name: me.name });
    if (problem) return setPwErr(problem);
    setBusy(true); setPwErr(null);
    try {
      const r: any = await AdminApi.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      if (r.token) AdminApi.setToken(r.token);
      setCur(''); setNext(''); toast('Password changed. Other sessions were signed out.');
    } catch (ex: any) { setPwErr(ex.message); } finally { setBusy(false); }
  };
  const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Change your password">
          <form onSubmit={changePassword} className="space-y-3">
            <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Current password</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></label>
            {pwErr && <div role="alert" className="text-sm text-rose-700">{pwErr}</div>}
            <Btn type="submit" variant="primary" disabled={busy || !cur || !next}>Change password</Btn>
          </form>
        </Card>
        <Card title="Security settings">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Password re-entry on sensitive actions</span><Badge tone={config.reauthRequired ? 'green' : 'red'} label={config.reauthRequired ? 'On' : 'OFF'} /></li>
            <li className="flex justify-between"><span>Manual payout approval</span><Badge tone={config.payoutApprovalRequired ? 'green' : 'slate'} label={config.payoutApprovalRequired ? 'On' : 'Off'} /></li>
            <li className="flex justify-between"><span>Payment mode</span><Badge tone={config.paymentMode === 'live' ? 'amber' : 'blue'} label={config.paymentMode} /></li>
            <li className="flex justify-between"><span>Platform commission</span><b>{config.commissionPercent}%</b></li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">Admin sessions last 8 hours. Five wrong passwords lock an admin account for 15 minutes.</p>
          <Btn className="mt-3" onClick={() => setConfirm({ title: 'Sign out of every device?', confirmLabel: 'Sign out everywhere', danger: true, run: async (v) => { await AdminApi.post('/auth/logout-all', { adminPassword: v.adminPassword }); signOut(); } })}>Sign out everywhere</Btn>
        </Card>
      </div>
      <DataList<AdminRow> path="/admins" columns={cols} refreshKey={refresh} emptyTitle="No admins" />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};
