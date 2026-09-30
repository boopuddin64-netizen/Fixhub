import React, { useState } from 'react';
import { AdminApi } from '../../api/adminClient';
import { Badge, Btn, Card, Column, ConfirmDialog, ConfirmSpec, DataList, Drawer, Dt, ErrorBox, KV, Spinner, useAdmin, useDetail } from '../ui';
import { labelize } from '../../utils/adminUi';
import { formatNaira } from '../../utils/format';

interface UserRow {
  id: string; name: string; email: string; phone: string; role: string; status: string; createdAt: string; lastLoginAt: string | null;
  emailVerified: boolean; authProvider: string; suspendedReason: string | null;
  technician?: { businessName: string; city: string; state: string; rating: number; reviewCount: number; completedJobs: number; kycStatus: string; isVerified: boolean; bankConfigured: boolean };
}

interface UserDetail {
  user: UserRow;
  technicianProfile: any | null;
  customerProfile: any | null;
  stats: { jobs: number; activeJobs: number; disputedJobs: number; spentNaira: number; earnedNaira: number; heldNaira: number; payoutsCompletedNaira: number };
  recentJobs: { id: string; status: string; deviceBrand: string; deviceModel: string; amountNaira: number; createdAt: string }[];
  recentReviews: { id: string; rating: number; comment: string; hidden?: boolean }[];
  recentActivity: { id: string; action: string; timestamp: string; actorId: string }[];
}

export const UserDrawer: React.FC<{ id: string | null; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { toast, me } = useAdmin();
  const { data, loading, error, reload } = useDetail<UserDetail>(id ? `/users/${encodeURIComponent(id)}` : null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const u = data?.user;
  const done = (msg: string) => { toast(msg); reload(); onChanged(); };

  const suspend = () => setConfirm({
    title: `Suspend ${u!.name}?`, danger: true, confirmLabel: 'Suspend account', needsReason: true, reasonLabel: 'Reason (shown in audit log)',
    description: 'They are signed out immediately, cannot log in, and technicians disappear from search. Jobs in progress are not cancelled automatically.',
    run: async (v) => { await AdminApi.post(`/users/${u!.id}/suspend`, { reason: v.reason, adminPassword: v.adminPassword }); done('Account suspended'); },
  });
  const reactivate = () => setConfirm({
    title: `Reactivate ${u!.name}?`, confirmLabel: 'Reactivate', needsReason: true, reasonOptional: true, needsPassword: false, reasonLabel: 'Note',
    run: async (v) => { await AdminApi.post(`/users/${u!.id}/reactivate`, { reason: v.reason }); done('Account reactivated'); },
  });
  const revoke = () => setConfirm({
    title: `Sign ${u!.name} out everywhere?`, confirmLabel: 'Revoke sessions', danger: true,
    description: 'All active sessions and tokens for this account stop working immediately.',
    run: async (v) => { await AdminApi.post(`/users/${u!.id}/revoke-sessions`, { adminPassword: v.adminPassword }); done('Sessions revoked'); },
  });
  const kyc = (decision: 'APPROVE' | 'REJECT') => setConfirm({
    title: decision === 'APPROVE' ? `Approve ${u!.technician?.businessName || u!.name}?` : `Reject verification for ${u!.technician?.businessName || u!.name}?`,
    danger: decision === 'REJECT', confirmLabel: decision === 'APPROVE' ? 'Approve & verify' : 'Reject', needsReason: true, reasonOptional: decision === 'APPROVE',
    reasonLabel: decision === 'REJECT' ? 'Reason (sent to the technician)' : 'Note',
    run: async (v) => { await AdminApi.post(`/technicians/${u!.id}/kyc`, { decision, reason: v.reason, adminPassword: v.adminPassword }); done(decision === 'APPROVE' ? 'Technician verified' : 'Verification rejected'); },
  });

  const tp = data?.technicianProfile;
  return (
    <>
      <Drawer open={Boolean(id)} onClose={onClose} title={u?.name || 'User'} subtitle={u ? `${labelize(u.role)} · ${u.id}` : undefined}>
        {loading && !data && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {u && data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={u.status} />
              {u.technician && <Badge value={u.technician.kycStatus} label={`KYC ${labelize(u.technician.kycStatus)}`} />}
              {!u.emailVerified && <Badge tone="amber" label="Email unverified" />}
            </div>
            {u.status === 'suspended' && u.suspendedReason && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Suspended: {u.suspendedReason}</div>}
            <Card title="Account">
              <dl className="divide-y divide-slate-100">
                <KV label="Email">{u.email}</KV>
                <KV label="Phone">{u.phone || '—'}</KV>
                <KV label="Sign-in method">{labelize(u.authProvider)}</KV>
                <KV label="Joined"><Dt value={u.createdAt} /></KV>
                <KV label="Last login"><Dt value={u.lastLoginAt} /></KV>
              </dl>
            </Card>
            <Card title="Activity summary">
              <dl className="divide-y divide-slate-100">
                <KV label="Jobs">{data.stats.jobs} ({data.stats.activeJobs} active, {data.stats.disputedJobs} disputed)</KV>
                {u.role === 'customer' && <KV label="Total spent">{formatNaira(data.stats.spentNaira)}</KV>}
                {u.role === 'technician' && <>
                  <KV label="Earned (released)">{formatNaira(data.stats.earnedNaira)}</KV>
                  <KV label="Held in escrow">{formatNaira(data.stats.heldNaira)}</KV>
                  <KV label="Paid out">{formatNaira(data.stats.payoutsCompletedNaira)}</KV>
                </>}
              </dl>
            </Card>
            {tp && (
              <Card title="Shop & verification">
                <dl className="divide-y divide-slate-100">
                  <KV label="Business">{tp.businessName}</KV>
                  <KV label="Location">{[tp.shopLocation?.address, tp.shopLocation?.city, tp.shopLocation?.state].filter(Boolean).join(', ') || '—'}</KV>
                  <KV label="Rating">{tp.rating ? `${tp.rating} (${tp.reviewCount} reviews)` : 'No reviews yet'}</KV>
                  <KV label="Identity / business">{tp.verificationStatus?.identityVerified ? 'Identity ✓' : 'Identity ✗'} · {tp.verificationStatus?.businessVerified ? 'Business ✓' : 'Business ✗'}</KV>
                  <KV label="Payout account">{tp.bankDetails?.accountNumber ? `${tp.bankDetails.bankName} · ${tp.bankDetails.accountNumber}${tp.bankDetails.verified ? ' (verified)' : ''}` : 'Not set'}</KV>
                  {tp.verificationStatus?.kycReview && <KV label="Last KYC review">{labelize(tp.verificationStatus.kycReview.status)} <Dt value={tp.verificationStatus.kycReview.reviewedAt} />{tp.verificationStatus.kycReview.reason ? ` — ${tp.verificationStatus.kycReview.reason}` : ''}</KV>}
                </dl>
              </Card>
            )}
            <Card title={`Recent jobs (${data.recentJobs.length})`}>
              {data.recentJobs.length === 0 ? <p className="text-sm text-slate-500">No jobs.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.recentJobs.slice(0, 8).map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 truncate">{j.deviceBrand} {j.deviceModel}</span><span className="flex items-center gap-2"><Badge value={j.status} /><span className="tabular-nums">{formatNaira(j.amountNaira)}</span></span></li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Recent admin & account activity">
              {data.recentActivity.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded.</p> : (
                <ul className="divide-y divide-slate-100 text-xs">
                  {data.recentActivity.slice(0, 10).map((a) => <li key={a.id} className="flex justify-between gap-2 py-1.5"><span>{labelize(a.action)}</span><Dt value={a.timestamp} /></li>)}
                </ul>
              )}
            </Card>
            {u.role !== 'admin' && u.id !== me.id && (
              <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white p-3">
                {u.technician && u.technician.kycStatus !== 'VERIFIED' && <Btn variant="primary" onClick={() => kyc('APPROVE')}>Approve KYC</Btn>}
                {u.technician && u.technician.kycStatus !== 'REJECTED' && <Btn onClick={() => kyc('REJECT')}>Reject KYC</Btn>}
                {u.status === 'suspended' ? <Btn variant="primary" onClick={reactivate}>Reactivate</Btn> : <Btn variant="danger" onClick={suspend}>Suspend</Btn>}
                <Btn onClick={revoke}>Sign out everywhere</Btn>
              </div>
            )}
          </>
        )}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

const STATUS_FILTER = { key: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }] };
const DATE_FILTERS = [{ key: 'from', label: 'Joined from', type: 'date' as const }, { key: 'to', label: 'to', type: 'date' as const }];

export const UsersSection: React.FC<{ technicians?: boolean; initialFilters?: Record<string, string> }> = ({ technicians, initialFilters }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const cols: Column<UserRow>[] = technicians
    ? [
        { key: 'business', header: 'Technician', sort: 'name', render: (u) => <div><div className="font-semibold text-slate-900">{u.technician?.businessName || u.name}</div><div className="text-xs text-slate-500">{u.name} · {u.email}</div></div> },
        { key: 'kyc', header: 'KYC', render: (u) => <Badge value={u.technician?.kycStatus} /> },
        { key: 'rating', header: 'Rating', sort: 'rating', render: (u) => (u.technician?.reviewCount ? `${u.technician.rating} (${u.technician.reviewCount})` : '—') },
        { key: 'jobs', header: 'Jobs done', render: (u) => u.technician?.completedJobs ?? 0 },
        { key: 'status', header: 'Status', render: (u) => <Badge value={u.status} /> },
        { key: 'joined', header: 'Joined', sort: 'createdAt', render: (u) => <Dt value={u.createdAt} /> },
      ]
    : [
        { key: 'name', header: 'User', sort: 'name', render: (u) => <div><div className="font-semibold text-slate-900">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></div> },
        { key: 'role', header: 'Role', render: (u) => <Badge value={u.role} tone={u.role === 'admin' ? 'violet' : 'slate'} /> },
        { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
        { key: 'status', header: 'Status', render: (u) => <Badge value={u.status} /> },
        { key: 'joined', header: 'Joined', sort: 'createdAt', render: (u) => <Dt value={u.createdAt} /> },
        { key: 'login', header: 'Last login', sort: 'lastLoginAt', render: (u) => <Dt value={u.lastLoginAt} /> },
      ];
  const filters = technicians
    ? [{ key: 'kyc', label: 'KYC', type: 'select' as const, options: [{ value: 'PENDING', label: 'Pending' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'REJECTED', label: 'Rejected' }] }, STATUS_FILTER, ...DATE_FILTERS]
    : [{ key: 'role', label: 'Role', type: 'select' as const, options: [{ value: 'customer', label: 'Customers' }, { value: 'technician', label: 'Technicians' }, { value: 'admin', label: 'Admins' }] }, STATUS_FILTER, ...DATE_FILTERS];
  return (
    <>
      <DataList<UserRow>
        key={technicians ? 'techs' : 'users'}
        path={technicians ? '/technicians' : '/users'}
        columns={cols}
        filters={filters}
        initialFilters={initialFilters}
        searchPlaceholder={technicians ? 'Search business, name, email, phone…' : 'Search name, email, phone or ID…'}
        onRowClick={(u) => setOpenId(u.id)}
        defaultSort={{ sort: 'createdAt', order: 'desc' }}
        refreshKey={refresh}
        emptyTitle={technicians ? 'No technicians yet' : 'No users yet'}
      />
      <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => setRefresh((r) => r + 1)} />
    </>
  );
};
