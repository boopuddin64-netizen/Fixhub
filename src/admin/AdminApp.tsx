import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { AdminApi } from '../api/adminClient';
import { ADMIN_SECTIONS, AdminSection, pathForSection, sectionFromPath } from '../utils/adminUi';
import { validateAdminPassword, adminPasswordStrength } from '../utils/adminPasswordPolicy';
import { AdminConfig, AdminContext, AdminCtx, Btn, Spinner, Toasts, errorMessage } from './ui';
import { Dashboard } from './sections/Dashboard';
import { UsersSection } from './sections/People';
import { JobsSection } from './sections/Operations';
import { EscrowSection, PaymentsSection, PayoutsSection, RefundsSection } from './sections/Money';
import { AdminsSection, AnnouncementsSection, AuditSection, ReviewsSection, RiskSection } from './sections/Trust';

interface Me { id: string; name: string; email: string; role: string; mustChangePassword?: boolean }

const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

const Shell: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <div><h1 className="text-lg font-extrabold text-slate-900">Fixhub Admin</h1>{title && <p className="text-xs text-slate-500">{title}</p>}</div>
      </div>
      {children}
    </div>
  </div>
);

const LoginScreen: React.FC<{ onLoggedIn: (token: string, mustChange: boolean) => void }> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setErr('Enter your admin email and password.');
    setBusy(true); setErr(null);
    try {
      const r = await AdminApi.post<{ token: string; mustChangePassword: boolean }>('/auth/login', { email: email.trim(), password });
      onLoggedIn(r.token, Boolean(r.mustChangePassword));
    } catch (ex: any) {
      setErr(ex?.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : errorMessage(ex));
      setBusy(false);
    }
  };
  return (
    <Shell title="Sign in to the operations portal">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoFocus /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></label>
        {err && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</div>}
        <Btn type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">Authorised Fixhub staff only. Activity is logged.</p>
    </Shell>
  );
};

const ChangePasswordScreen: React.FC<{ me: Me; forced: boolean; onDone: (token: string) => void; onSignOut: () => void }> = ({ me, forced, onDone, onSignOut }) => {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const strength = adminPasswordStrength(next);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateAdminPassword(next, { email: me.email, name: me.name });
    if (!cur) return setErr('Enter your current password.');
    if (problem) return setErr(problem);
    if (next !== again) return setErr('The two new passwords do not match.');
    setBusy(true); setErr(null);
    try {
      const r = await AdminApi.post<{ token: string }>('/auth/change-password', { currentPassword: cur, newPassword: next });
      onDone(r.token);
    } catch (ex) { setErr(errorMessage(ex)); setBusy(false); }
  };
  return (
    <Shell title={forced ? 'Choose a new password to continue' : 'Change password'}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <p className="text-sm text-slate-600">Signed in as <b>{me.email}</b>. Use at least 12 characters with upper and lower case letters, a number and a symbol.</p>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Current (temporary) password</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
          {next && <span className="mt-1 block text-xs text-slate-500" aria-live="polite">Strength: <b>{['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]}</b></span>}</label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Repeat new password</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} /></label>
        {err && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</div>}
        <Btn type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Btn>
        <button type="button" onClick={onSignOut} className="w-full text-center text-xs text-slate-500 underline">Sign out</button>
      </form>
    </Shell>
  );
};

const GROUPS = ['Overview', 'People', 'Operations', 'Money', 'Trust & safety', 'System'] as const;

const AdminApp: React.FC = () => {
  const [phase, setPhase] = useState<'checking' | 'login' | 'change-password' | 'ready' | 'denied'>('checking');
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [section, setSection] = useState<AdminSection>(() => sectionFromPath(window.location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: 'success' | 'error' }[]>([]);

  const toast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 4500);
  }, []);

  const signOut = useCallback(() => {
    AdminApi.raw('POST', '/auth/logout', {}).catch(() => {});
    AdminApi.clearToken();
    setMe(null); setConfig(null); setPhase('login');
  }, []);

  const loadMe = useCallback(async () => {
    if (!AdminApi.getToken()) { setPhase('login'); return; }
    try {
      const r = await AdminApi.get<{ user: Me; config: AdminConfig }>('/me');
      setMe(r.user); setConfig(r.config);
      setPhase(r.user.mustChangePassword ? 'change-password' : 'ready');
    } catch (e: any) {
      // Invalid/expired token or not an admin: back to the sign-in form (the token is useless anyway)
      if (e?.status === 401 || e?.status === 403) { AdminApi.clearToken(); setPhase('login'); }
      else { toast(errorMessage(e), 'error'); setPhase('login'); }
    }
  }, [toast]);

  useEffect(() => {
    document.title = 'Fixhub Admin';
    AdminApi.onUnauthorized(() => { AdminApi.clearToken(); setMe(null); setPhase('login'); toast('Your session expired. Please sign in again.', 'error'); });
    AdminApi.onPasswordChangeRequired(() => setPhase('change-password'));
    loadMe();
    return () => { AdminApi.onUnauthorized(null); AdminApi.onPasswordChangeRequired(null); };
  }, [loadMe, toast]);

  useEffect(() => {
    const onPop = () => setSection(sectionFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((s: string) => {
    const next = (ADMIN_SECTIONS.find((x) => x.id === s)?.id ?? 'dashboard') as AdminSection;
    setSection(next);
    setMenuOpen(false);
    if (window.location.pathname !== pathForSection(next)) window.history.pushState({}, '', pathForSection(next));
    window.scrollTo?.(0, 0);
  }, []);

  const ctx: AdminCtx | null = useMemo(() => (me && config ? { me, config, toast, navigate, signOut } : null), [me, config, toast, navigate, signOut]);

  if (phase === 'checking') return <div className="min-h-dvh bg-slate-100"><Spinner label="Checking your session…" /></div>;
  if (phase === 'login') return (<><LoginScreen onLoggedIn={(t, must) => { AdminApi.setToken(t); loadMe(); if (must) setPhase('change-password'); }} /><Toasts items={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} /></>);
  if (phase === 'change-password' && me) return <ChangePasswordScreen me={me} forced onDone={(t) => { AdminApi.setToken(t); loadMe(); }} onSignOut={signOut} />;
  if (!ctx || !me) return <div className="min-h-dvh bg-slate-100"><Spinner /></div>;

  const current = ADMIN_SECTIONS.find((s) => s.id === section)!;
  const content = (() => {
    switch (section) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <UsersSection />;
      case 'technicians': return <UsersSection technicians />;
      case 'jobs': return <JobsSection />;
      case 'disputes': return <JobsSection disputesOnly />;
      case 'payments': return <PaymentsSection />;
      case 'escrow': return <EscrowSection />;
      case 'refunds': return <RefundsSection />;
      case 'payouts': return <PayoutsSection />;
      case 'reviews': return <ReviewsSection />;
      case 'risk': return <RiskSection />;
      case 'audit': return <AuditSection />;
      case 'announcements': return <AnnouncementsSection />;
      case 'admins': return <AdminsSection />;
    }
  })();

  const nav = (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => (
        <div key={g} className="mb-4">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g}</div>
          {ADMIN_SECTIONS.filter((s) => s.group === g).map((s) => (
            <button key={s.id} onClick={() => navigate(s.id)} aria-current={s.id === section ? 'page' : undefined}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${s.id === section ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-dvh bg-slate-100 text-slate-800 lg:flex">
        <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-4 text-white"><ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden="true" /><span className="font-extrabold">Fixhub Admin</span></div>
          {nav}
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="relative flex h-full w-72 max-w-[85%] flex-col bg-slate-900" role="dialog" aria-modal="true" aria-label="Admin menu">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 text-white"><span className="font-extrabold">Fixhub Admin</span><button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
              {nav}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
              <h1 className="truncate text-lg font-extrabold text-slate-900">{current.label}</h1>
              {config?.paymentMode === 'live' ? <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 sm:inline">LIVE PAYMENTS</span> : <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 sm:inline">SANDBOX</span>}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-right leading-tight sm:block"><span className="block font-semibold text-slate-800">{me.name}</span><span className="block text-xs text-slate-500">{me.email}</span></span>
              <Btn small onClick={signOut}><LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out</Btn>
            </div>
          </header>
          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <Suspense fallback={<Spinner />}>{content}</Suspense>
          </main>
        </div>
      </div>
      <Toasts items={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </AdminContext.Provider>
  );
};

export default AdminApp;
