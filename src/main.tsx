import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Prevent unwanted pinch-to-zoom gestures safely on iOS Safari
if (typeof document !== 'undefined') {
  const safePrevent = (e: Event) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  };
  document.addEventListener('gesturestart', safePrevent);
  document.addEventListener('gesturechange', safePrevent);
  document.addEventListener('gestureend', safePrevent);
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

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error('Failed to locate #root DOM container.');
}
