import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
