import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, User } from '../../types';
import { Loader2 } from 'lucide-react';

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
  const { socialLogin } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | null>(null);
  const [googleNativeReady, setGoogleNativeReady] = useState<boolean>(false);

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
                'Google Sign-In popup could not complete. Please check browser pop-up settings.';
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
      onError('Google Client ID is not configured.');
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
            onErrorRef.current(nonOAuthErr?.message || 'Google popup was blocked or unable to complete.');
            setLoadingProvider(null);
          },
        });
        tokenClientRef.current = client;
        client.requestAccessToken({ prompt: '' });
        return;
      }

      onError('Google authentication service is initializing. Please try again.');
      setLoadingProvider(null);
    } catch (err: any) {
      onError(err?.message || 'Failed to open Google authentication window.');
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
          {loadingProvider === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
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
          )}
          <span>{loadingProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>
      )}
    </div>
  );
};
