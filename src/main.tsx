import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Prevent unwanted pinch-to-zoom gestures and zoom scaling on mobile devices
if (typeof document !== 'undefined') {
  document.addEventListener(
    'gesturestart',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener(
    'gesturechange',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener(
    'gestureend',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
}

// Suppress unhandled errors and rejections from third-party browser extensions (e.g. MetaMask, Phantom)
if (typeof window !== 'undefined') {
  const isExtensionError = (err: any): boolean => {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : err.message || err.reason?.message || err.reason || '';
    const s = String(msg).toLowerCase();
    return (
      s.includes('metamask') ||
      s.includes('ethereum') ||
      s.includes('chrome-extension://') ||
      s.includes('moz-extension://') ||
      (s.includes('wallet') && s.includes('connect'))
    );
  };

  window.addEventListener(
    'error',
    (event) => {
      if (isExtensionError(event.error) || isExtensionError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isExtensionError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
