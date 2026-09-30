import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminApi } from '../../api/adminClient';
import { Btn, Card, ErrorBox, Spinner, errorMessage, useAdmin } from '../ui';
import { TrendPoint, barWidths, chartGeometry, labelize } from '../../utils/adminUi';
import { formatCount, formatNaira, formatDateTime } from '../../utils/format';

interface Stats {
  generatedAt: string;
  users: { total: number; customers: number; technicians: number; admins: number; suspended: number; newLast7Days: number; newLast30Days: number };
  technicians: { total: number; verified: number; pendingKyc: number; rejectedKyc: number; available: number };
  jobs: { total: number; byStatus: Record<string, number>; active: number; completed: number; disputed: number };
  requests: { total: number; open: number };
  money: { gmvNaira: number; paidPayments: number; escrowHeldNaira: number; platformFeesEarnedNaira: number; platformFeesPendingNaira: number; refundedNaira: number };
  refunds: { count: number; pending: number; totalNaira: number };
  payouts: { count: number; awaitingApproval: number; awaitingApprovalNaira: number; processing: number; completedNaira: number; failed: number };
  risk: { openDisputes: number; unreviewedRiskEvents: number };
  trend: TrendPoint[];
}

const Stat: React.FC<{ label: string; value: string; sub?: string; onClick?: () => void; alert?: boolean }> = ({ label, value, sub, onClick, alert }) => {
  const body = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${alert ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </>
  );
  const cls = 'rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm';
  return onClick ? <button onClick={onClick} className={`${cls} transition hover:border-blue-300 hover:shadow`}>{body}</button> : <div className={cls}>{body}</div>;
};

const TrendChart: React.FC<{ title: string; points: TrendPoint[]; pick: (p: TrendPoint) => number; money?: boolean; color: string }> = ({ title, points, pick, money, color }) => {
  const values = points.map(pick);
  const g = chartGeometry(values, 320, 90);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <Card title={title} action={<span className="text-xs font-semibold text-slate-500">14 days: {money ? formatNaira(total) : formatCount(total)}</span>}>
      <svg viewBox="0 0 320 90" className="h-24 w-full" role="img" aria-label={`${title}, last 14 days, total ${money ? formatNaira(total) : total}`}>
        <polygon points={g.area} fill={color} opacity="0.12" />
        <polyline points={g.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {g.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color}><title>{`${points[i].date}: ${money ? formatNaira(p.value) : p.value}`}</title></circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{points[0]?.date.slice(5)}</span><span>{points[points.length - 1]?.date.slice(5)}</span></div>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const { navigate } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    AdminApi.get<Stats>('/stats').then((s) => { if (!cancelled) setStats(s); }).catch((e) => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [nonce]);

  if (error) return <ErrorBox message={error} onRetry={() => setNonce((n) => n + 1)} />;
  if (!stats) return <Spinner label="Loading dashboard…" />;
  const bars = barWidths(Object.entries(stats.jobs.byStatus).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value));
  const needsAttention = stats.technicians.pendingKyc + stats.payouts.awaitingApproval + stats.risk.openDisputes + stats.risk.unreviewedRiskEvents;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Updated {formatDateTime(stats.generatedAt)} (WAT)</p>
        <Btn small onClick={() => setNonce((n) => n + 1)}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh</Btn>
      </div>

      {needsAttention > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Needs your attention</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {stats.technicians.pendingKyc > 0 && <Btn small onClick={() => navigate('technicians')}>{stats.technicians.pendingKyc} technician(s) awaiting KYC</Btn>}
            {stats.risk.openDisputes > 0 && <Btn small onClick={() => navigate('disputes')}>{stats.risk.openDisputes} open dispute(s)</Btn>}
            {stats.payouts.awaitingApproval > 0 && <Btn small onClick={() => navigate('payouts')}>{stats.payouts.awaitingApproval} payout(s) to approve ({formatNaira(stats.payouts.awaitingApprovalNaira)})</Btn>}
            {stats.risk.unreviewedRiskEvents > 0 && <Btn small onClick={() => navigate('risk')}>{stats.risk.unreviewedRiskEvents} unreviewed risk event(s)</Btn>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="GMV (paid)" value={formatNaira(stats.money.gmvNaira)} sub={`${formatCount(stats.money.paidPayments)} payments`} onClick={() => navigate('payments')} />
        <Stat label="Escrow held" value={formatNaira(stats.money.escrowHeldNaira)} sub="paid, not yet released" onClick={() => navigate('escrow')} />
        <Stat label="Platform fees earned" value={formatNaira(stats.money.platformFeesEarnedNaira)} sub={`${formatNaira(stats.money.platformFeesPendingNaira)} pending release`} />
        <Stat label="Refunded" value={formatNaira(stats.money.refundedNaira)} sub={`${stats.refunds.count} refund(s)`} onClick={() => navigate('refunds')} />
        <Stat label="Users" value={formatCount(stats.users.total)} sub={`${stats.users.customers} customers · ${stats.users.technicians} technicians`} onClick={() => navigate('users')} />
        <Stat label="Technicians verified" value={`${stats.technicians.verified}/${stats.technicians.total}`} sub={`${stats.technicians.pendingKyc} pending · ${stats.technicians.rejectedKyc} rejected`} onClick={() => navigate('technicians')} />
        <Stat label="Jobs" value={formatCount(stats.jobs.total)} sub={`${stats.jobs.active} active · ${stats.jobs.completed} completed`} onClick={() => navigate('jobs')} />
        <Stat label="Disputes" value={String(stats.risk.openDisputes)} sub="jobs in dispute" alert={stats.risk.openDisputes > 0} onClick={() => navigate('disputes')} />
        <Stat label="Payouts completed" value={formatNaira(stats.payouts.completedNaira)} sub={`${stats.payouts.processing} processing · ${stats.payouts.failed} failed/rejected`} onClick={() => navigate('payouts')} />
        <Stat label="Awaiting payout approval" value={String(stats.payouts.awaitingApproval)} sub={formatNaira(stats.payouts.awaitingApprovalNaira)} alert={stats.payouts.awaitingApproval > 0} onClick={() => navigate('payouts')} />
        <Stat label="New users (7 days)" value={formatCount(stats.users.newLast7Days)} sub={`${stats.users.newLast30Days} in 30 days`} />
        <Stat label="Suspended accounts" value={String(stats.users.suspended)} sub={`${stats.users.admins} admin(s)`} onClick={() => navigate('users')} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <TrendChart title="Paid volume" points={stats.trend} pick={(p) => p.gmvNaira} money color="#2563eb" />
        <TrendChart title="New jobs" points={stats.trend} pick={(p) => p.jobs} color="#059669" />
        <TrendChart title="New sign-ups" points={stats.trend} pick={(p) => p.newUsers} color="#7c3aed" />
      </div>

      <Card title="Jobs by status">
        {bars.length === 0 ? <p className="text-sm text-slate-500">No jobs yet.</p> : (
          <ul className="space-y-2">
            {bars.map((b) => (
              <li key={b.key} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 truncate text-slate-600">{labelize(b.key)}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${Math.max(3, b.pct)}%` }} /></div>
                <span className="w-8 text-right font-semibold tabular-nums">{b.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
