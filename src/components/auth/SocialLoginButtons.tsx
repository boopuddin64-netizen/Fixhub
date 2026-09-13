import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, User } from '../../types';

interface SocialLoginButtonsProps {
  role: UserRole;
  onSuccess: (user: User) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: any;
    AppleID?: any;
    FB?: any;
    fbAsyncInit?: any;
  }
}

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  role,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { socialLogin } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'facebook' | null>(null);

  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      onError('Google Sign-In is not yet configured on this environment (missing VITE_GOOGLE_CLIENT_ID).');
      return;
    }

    setLoadingProvider('google');
    try {
      if (!window.google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
          document.head.appendChild(script);
        });
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            if (!response.credential) {
              throw new Error('No credential received from Google.');
            }
            const result = await socialLogin('google', response.credential, role as 'customer' | 'technician');
            onSuccess(result.user);
          } catch (err: any) {
            onError(err.message || 'Google authentication failed.');
          } finally {
            setLoadingProvider(null);
          }
        },
      });

      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLoadingProvider(null);
        }
      });
    } catch (err: any) {
      onError(err.message || 'Failed to initialize Google Sign-In.');
      setLoadingProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    if (!clientId) {
      onError('Apple Sign-In is not yet configured on this environment (missing VITE_APPLE_CLIENT_ID).');
      return;
    }

    setLoadingProvider('apple');
    try {
      if (!window.AppleID) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/auth.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Apple Sign-In SDK'));
          document.head.appendChild(script);
        });
      }

      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });

      const response = await window.AppleID.auth.signIn();
      const identityToken = response.authorization?.id_token;
      if (!identityToken) {
        throw new Error('No identity token received from Apple.');
      }

      const result = await socialLogin('apple', identityToken, role as 'customer' | 'technician');
      onSuccess(result.user);
    } catch (err: any) {
      onError(err.message || 'Apple Sign-In failed or was cancelled.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleFacebookLogin = async () => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId) {
      onError('Facebook Login is not yet configured on this environment (missing VITE_FACEBOOK_APP_ID).');
      return;
    }

    setLoadingProvider('facebook');
    try {
      if (!window.FB) {
        await new Promise<void>((resolve, reject) => {
          window.fbAsyncInit = () => {
            window.FB.init({
              appId,
              cookie: true,
              xfbml: true,
              version: 'v18.0',
            });
            resolve();
          };
          const script = document.createElement('script');
          script.src = 'https://connect.facebook.net/en_US/sdk.js';
          script.async = true;
          script.defer = true;
          script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
          document.head.appendChild(script);
        });
      }

      window.FB.login(
        async (response: any) => {
          try {
            if (response.authResponse?.accessToken) {
              const result = await socialLogin('facebook', response.authResponse.accessToken, role as 'customer' | 'technician');
              onSuccess(result.user);
            } else {
              throw new Error('Facebook login was not completed or permission was denied.');
            }
          } catch (err: any) {
            onError(err.message || 'Facebook login failed.');
          } finally {
            setLoadingProvider(null);
          }
        },
        { scope: 'public_profile,email' }
      );
    } catch (err: any) {
      onError(err.message || 'Failed to initialize Facebook Login.');
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-2.5 my-3">
      {/* Google */}
      <button
        type="button"
        id="btn-social-google"
        onClick={handleGoogleLogin}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition-all shadow-xs border border-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Apple */}
      <button
        type="button"
        id="btn-social-apple"
        onClick={handleAppleLogin}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-black hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs border border-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.86-12-14.46-6.1-9.35-10.9-20.2-14.42-32.55-3.52-12.35-5.28-24.23-5.28-35.65 0-14.54 3.73-26.68 11.19-36.42 7.46-9.74 16.73-14.73 27.81-14.97 4.93 0 10.51 1.34 16.73 4.02 6.22 2.68 10.15 4.08 11.78 4.19 1.31-.11 5.37-1.57 12.19-4.37 6.82-2.8 12.56-4.05 17.23-3.75 12.98.65 23.36 5.56 31.13 14.73-11.45 6.94-17.06 16.54-16.82 28.79.24 9.68 3.99 17.75 11.25 24.21 7.26 6.46 15.93 10.1 26.01 10.91-2.14 6.74-4.73 13.43-7.77 20.06zM119.22 33.64c0-7.39 2.68-14.35 8.04-20.88 5.36-6.53 11.96-10.79 19.8-12.76.24 1.3.36 2.5.36 3.6 0 7.28-2.8 14.31-8.4 21.08-5.6 6.77-12.33 10.82-20.2 12.16-.24-1.07-.36-2.13-.36-3.2z" />
        </svg>
        <span>{loadingProvider === 'apple' ? 'Connecting to Apple...' : 'Continue with Apple'}</span>
      </button>

      {/* Facebook */}
      <button
        type="button"
        id="btn-social-facebook"
        onClick={handleFacebookLogin}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span>{loadingProvider === 'facebook' ? 'Connecting to Facebook...' : 'Continue with Facebook'}</span>
      </button>
    </div>
  );
};
