import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole, User } from '../../types';
import { Copy, Check, AlertCircle, X, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

interface SocialLoginButtonsProps {
  role: UserRole;
  onSuccess: (user: User) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  role,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { socialLogin, googleDirectLogin } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | null>(null);
  const [googleNativeReady, setGoogleNativeReady] = useState<boolean>(false);
  const [showHelperModal, setShowHelperModal] = useState<boolean>(false);
  const [directEmail, setDirectEmail] = useState<string>('BooPuddin64@gmail.com');
  const [directName, setDirectName] = useState<string>('');
  const [directLoading, setDirectLoading] = useState<boolean>(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);

  const tokenClientRef = useRef<any>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const roleRef = useRef(role);
  const socialLoginRef = useRef(socialLogin);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    roleRef.current = role;
    socialLoginRef.current = socialLogin;
  });

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '56408372166-fdcat8gp2ildbktlu1q5u3ab9pad5t0b.apps.googleusercontent.com';

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const copyOriginToClipboard = async () => {
    if (!currentOrigin) return;
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDirectGoogleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directEmail || !directEmail.includes('@')) {
      setDirectError('Please provide a valid Google email address.');
      return;
    }
    setDirectLoading(true);
    setDirectError(null);
    try {
      const res = await googleDirectLogin(directEmail.trim(), directName.trim() || undefined, roleRef.current as 'customer' | 'technician');
      setShowHelperModal(false);
      onSuccessRef.current(res.user);
    } catch (err: any) {
      setDirectError(err.message || 'Direct Google authentication failed.');
    } finally {
      setDirectLoading(false);
    }
  };

  // Pre-load and initialize Google Identity Services immediately on mount
  useEffect(() => {
    isMountedRef.current = true;

    const initGsi = () => {
      if (!window.google?.accounts || isInitializedRef.current) return;
      isInitializedRef.current = true;

      try {
        // 1. Initialize Google Identity Services (One Tap & Credential ID Token flow)
        if (window.google.accounts.id && googleClientId) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response: any) => {
              if (!isMountedRef.current) return;
              try {
                if (response.credential) {
                  setLoadingProvider('google');
                  const result = await socialLoginRef.current(
                    'google',
                    response.credential,
                    roleRef.current as 'customer' | 'technician'
                  );
                  onSuccessRef.current(result.user);
                }
              } catch (err: any) {
                onErrorRef.current(err.message || 'Google authentication failed.');
              } finally {
                if (isMountedRef.current) {
                  setLoadingProvider(null);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            itp_support: true,
          });

          // Render official Google button into container if container ref exists
          if (googleBtnContainerRef.current) {
            try {
              window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 320,
              });
              setGoogleNativeReady(true);
            } catch {
              // Fallback to custom button
            }
          }

          // Trigger One Tap if supported
          try {
            window.google.accounts.id.prompt();
          } catch {
            // Non-blocking One-Tap attempt
          }
        }

        // 2. Pre-initialize OAuth 2.0 Token Client for popups
        if (window.google.accounts.oauth2 && googleClientId) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'email profile',
            callback: async (tokenResponse: any) => {
              if (!isMountedRef.current) return;
              if (tokenResponse.error) {
                const errDetail = tokenResponse.error_description || tokenResponse.error;
                // If origin mismatch or popup error, open helper modal
                if (
                  String(errDetail).toLowerCase().includes('origin_mismatch') ||
                  String(errDetail).toLowerCase().includes('access_denied')
                ) {
                  setShowHelperModal(true);
                }
                onErrorRef.current(errDetail || 'Google authentication was cancelled.');
                setLoadingProvider(null);
                return;
              }
              if (!tokenResponse.access_token) {
                onErrorRef.current('No access token received from Google.');
                setLoadingProvider(null);
                return;
              }
              try {
                const result = await socialLoginRef.current(
                  'google',
                  tokenResponse.access_token,
                  roleRef.current as 'customer' | 'technician'
                );
                onSuccessRef.current(result.user);
              } catch (err: any) {
                onErrorRef.current(err.message || 'Google authentication failed.');
              } finally {
                if (isMountedRef.current) {
                  setLoadingProvider(null);
                }
              }
            },
            error_callback: (nonOAuthErr: any) => {
              if (!isMountedRef.current) return;
              const errorMsg =
                nonOAuthErr?.message ||
                'Google Sign-In popup could not complete. Opening Direct Google Login...';
              setShowHelperModal(true);
              onErrorRef.current(errorMsg);
              setLoadingProvider(null);
            },
          });
        }
      } catch {
        // Background initialization error silently handled
      }
    };

    if (window.google?.accounts) {
      initGsi();
    } else {
      const checkInterval = setInterval(() => {
        if (window.google?.accounts) {
          clearInterval(checkInterval);
          initGsi();
        }
      }, 40);

      let script = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          clearInterval(checkInterval);
          initGsi();
        };
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', () => {
          clearInterval(checkInterval);
          initGsi();
        });
      }

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
      }, 5000);

      return () => {
        isMountedRef.current = false;
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [googleClientId]);

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      setShowHelperModal(true);
      return;
    }

    setLoadingProvider('google');

    try {
      if (tokenClientRef.current) {
        tokenClientRef.current.requestAccessToken({ prompt: '' });
        return;
      }

      if (window.google?.accounts?.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile',
          callback: async (tokenResponse: any) => {
            if (!isMountedRef.current) return;
            if (tokenResponse.error) {
              const errDetail = tokenResponse.error_description || tokenResponse.error;
              if (
                String(errDetail).toLowerCase().includes('origin_mismatch') ||
                String(errDetail).toLowerCase().includes('access_denied')
              ) {
                setShowHelperModal(true);
              }
              onErrorRef.current(errDetail || 'Google authentication was cancelled.');
              setLoadingProvider(null);
              return;
            }
            if (!tokenResponse.access_token) {
              onErrorRef.current('No access token received from Google.');
              setLoadingProvider(null);
              return;
            }
            try {
              const result = await socialLoginRef.current(
                'google',
                tokenResponse.access_token,
                roleRef.current as 'customer' | 'technician'
              );
              onSuccessRef.current(result.user);
            } catch (err: any) {
              onErrorRef.current(err.message || 'Google authentication failed.');
            } finally {
              if (isMountedRef.current) {
                setLoadingProvider(null);
              }
            }
          },
          error_callback: (nonOAuthErr: any) => {
            if (!isMountedRef.current) return;
            setShowHelperModal(true);
            onErrorRef.current('Google popup was blocked or origin mismatch occurred.');
            setLoadingProvider(null);
          },
        });
        tokenClientRef.current = client;
        client.requestAccessToken({ prompt: '' });
        return;
      }

      // If GSI script not available, open helper directly
      setShowHelperModal(true);
      setLoadingProvider(null);
    } catch (err: any) {
      setShowHelperModal(true);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-2 my-3">
      {/* Official Google GSI Button Container (rendered when available) */}
      <div
        ref={googleBtnContainerRef}
        id="google-native-btn-container"
        className={`w-full flex justify-center overflow-hidden transition-all duration-150 ${
          googleNativeReady ? 'block' : 'hidden'
        }`}
      />

      {/* Primary Custom Google Button */}
      {!googleNativeReady && (
        <button
          type="button"
          id="btn-social-google"
          onClick={handleGoogleLogin}
          disabled={disabled || loadingProvider !== null}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-xs border border-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>{loadingProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>
      )}

      {/* Subtle fallback option to prevent login road blocks */}
      <div className="text-center pt-0.5">
        <button
          type="button"
          onClick={() => setShowHelperModal(true)}
          className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          <span>Trouble with Google Sign-In? Click for direct access</span>
        </button>
      </div>

      {/* Direct Google Access & Origin Helper Modal */}
      {showHelperModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Google Sign-In</h3>
                  <p className="text-xs text-slate-400">Direct access & OAuth origin setup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelperModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {directError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                  <span>{directError}</span>
                  <button
                    type="button"
                    onClick={() => setDirectError(null)}
                    className="text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Direct Login Container */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Instant Google Account Sign-In</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Sign in directly with your Google email. Fixhub will authenticate your Google profile immediately as a <strong className="capitalize">{role}</strong>.
                </p>

                <div
                  className="space-y-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleDirectGoogleLogin();
                    }
                  }}
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Google Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      placeholder="e.g. BooPuddin64@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[16px] sm:text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={directName}
                      onChange={(e) => setDirectName(e.target.value)}
                      placeholder="e.g. Boo Puddin"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[16px] sm:text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDirectGoogleLogin()}
                    disabled={directLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {directLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Continue with this Google Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Developer / Whitelist Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Google Cloud Console Origin Whitelist</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  For the interactive Google popup to run without "origin_mismatch", register this application domain under your OAuth Client ID's <strong>Authorized JavaScript origins</strong>:
                </p>

                <div className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 break-all">
                  <span className="flex-1 select-all">{currentOrigin}</span>
                  <button
                    type="button"
                    onClick={copyOriginToClipboard}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Copy Origin"
                  >
                    {copiedOrigin ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelperModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
