import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { validateNewPassword } from '../../utils/passwordPolicy';

interface SetPasswordFormProps {
  /** Short explanation shown above the fields (e.g. why a password is needed for this action). */
  intro?: string;
  /** Called after the password was saved and the session refreshed. */
  onDone?: () => void;
  /** Visual density: 'card' (grey card, profile pages) or 'inline' (inside a red confirm dialog). */
  variant?: 'card' | 'inline';
}

/**
 * Lets a social-login-only (Google) account create its first password. Used in Account & Security and inside the
 * delete-account / switch-role dialogs when the API answers 403 PASSWORD_NOT_SET.
 */
export const SetPasswordForm: React.FC<SetPasswordFormProps> = ({ intro, onDone, variant = 'card' }) => {
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setMsg({ type: 'error', text: problem });
      return;
    }
    setSaving(true);
    try {
      const res = await ApiClient.setPassword(password); // stores the fresh token
      await refreshUser();
      setPassword('');
      setConfirmation('');
      setMsg({ type: 'success', text: res.message || 'Password set.' });
      onDone?.();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to set password.' });
    } finally {
      setSaving(false);
    }
  };

  const wrapper = variant === 'card' ? 'p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3' : 'space-y-2';
  const inputCls =
    'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900';

  return (
    <form onSubmit={submit} className={wrapper} data-testid="set-password-form">
      {intro && <p className="text-[11px] text-slate-600 leading-relaxed">{intro}</p>}
      {msg && (
        <div
          role={msg.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
      <div>
        <label htmlFor="set-password-new" className="block text-[11px] font-bold text-slate-600 mb-1">
          New Password (min 8 chars, 1 number)
        </label>
        <input
          id="set-password-new"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="set-password-confirm" className="block text-[11px] font-bold text-slate-600 mb-1">
          Confirm Password
        </label>
        <input
          id="set-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Re-enter password"
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        <span>Set Password</span>
      </button>
    </form>
  );
};
