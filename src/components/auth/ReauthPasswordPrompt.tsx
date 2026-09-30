import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SetPasswordForm } from './SetPasswordForm';
import { isPasswordNotSetError, reauthStep } from '../../utils/passwordPolicy';

interface ReauthPasswordPromptProps {
  /** Text of the primary button, e.g. "Yes, Delete Account" or "Switch Role". */
  confirmLabel: string;
  /** Performs the sensitive action with the typed password. Throw the ApiClient error to keep the dialog open. */
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
  /** 'danger' = red dialog (delete account); 'neutral' = indigo (switch role). */
  tone?: 'danger' | 'neutral';
  inputId?: string;
}

/**
 * Password re-authentication step shared by the delete-account and switch-role dialogs.
 * Social-login-only accounts have no password: they are asked to set one first (either up front, when the profile says
 * `hasPassword === false`, or after the API answers 403 PASSWORD_NOT_SET), then continue with the same dialog.
 */
export const ReauthPasswordPrompt: React.FC<ReauthPasswordPromptProps> = ({
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
  inputId = 'reauth-password',
}) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordNotSet, setPasswordNotSet] = useState(false);
  const [justSet, setJustSet] = useState(false);

  const step = reauthStep(passwordNotSet ? false : user?.hasPassword, passwordNotSet);
  const danger = tone === 'danger';

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err: any) {
      if (isPasswordNotSetError(err)) {
        setPasswordNotSet(true);
      } else {
        setError(err?.message || 'Password confirmation failed.');
      }
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'set-password') {
    return (
      <div className="space-y-2" data-testid="reauth-set-password">
        <p className={`text-xs font-bold ${danger ? 'text-rose-900' : 'text-slate-900'}`}>Set a password first</p>
        <SetPasswordForm
          variant="inline"
          intro="You signed in with Google, so this account has no password yet. Create one to confirm this action; you can keep using Google sign-in too."
          onDone={() => {
            setPasswordNotSet(false);
            setJustSet(true);
          }}
        />
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {justSet && (
        <p role="status" className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
          Password set. Enter it below to continue.
        </p>
      )}
      <input
        id={inputId}
        type="password"
        autoComplete="current-password"
        aria-label="Confirm your password"
        placeholder="Confirm your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`w-full px-3 py-2 rounded-lg border bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 ${
          danger ? 'border-rose-200 focus:ring-rose-400' : 'border-slate-200 focus:ring-indigo-400'
        }`}
      />
      {error && (
        <p role="alert" className="text-[11px] text-rose-800">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setPassword('');
            onCancel();
          }}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy || !password}
          className={`px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{confirmLabel}</span>
        </button>
      </div>
    </div>
  );
};
