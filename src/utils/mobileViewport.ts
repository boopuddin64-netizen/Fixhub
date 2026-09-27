/**
 * FixHub Mobile Viewport & iOS/Android Keyboard Zoom-Lock Prevention Engine
 * 
 * Solves:
 * 1. iOS Safari and Android virtual keyboard auto-zooming or layout displacement.
 * 2. Viewport staying zoomed in after keyboard dismisses or after filling bank/profile details.
 * 3. Restores visual viewport scale back to 1.0 immediately when:
 *    - The keyboard closes / goes off (visualViewport resize, focusout, window resize)
 *    - The user presses Enter / Done on mobile keyboard
 *    - Modals close or forms submit
 */

let isInitialized = false;

/**
 * Force-resets the viewport scale back to 1.0 and clears any horizontal zoom drift.
 * Works reliably across iOS Safari, WebKit webviews, and Android Chrome.
 */
export function forceResetViewportZoom(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Blur any active form field if still focused
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
    active.blur();
  }

  // 2. Clear horizontal scroll offsets immediately
  window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' as ScrollBehavior });
  if (document.documentElement) document.documentElement.scrollLeft = 0;
  if (document.body) document.body.scrollLeft = 0;

  // 3. Toggling the viewport meta tag forces WebKit & Android to recalculate
  // their internal visualViewport scale matrix and snap back to 1.0.
  const oldMeta = document.querySelector('meta[name="viewport"]');
  const contentFixed = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  const contentNormal = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover';

  if (oldMeta) {
    oldMeta.setAttribute('content', contentFixed);
  }

  // Force layout reflow
  void document.documentElement.offsetHeight;
  void document.body.offsetHeight;

  // Clear any visualViewport horizontal offset
  if (window.visualViewport) {
    if (window.visualViewport.pageLeft !== 0 || window.visualViewport.offsetLeft !== 0) {
      window.scrollTo(0, window.scrollY);
    }
  }

  // Schedule full reset to allow virtual keyboard collapse animation to complete
  setTimeout(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute('content', contentNormal);
    }
    window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' as ScrollBehavior });
    if (window.visualViewport) {
      window.scrollTo(0, window.scrollY);
    }
  }, 100);
}

/**
 * Initializes global event listeners to prevent mobile focus-zoom and auto-reset zoom on blur or Enter.
 */
export function initMobileViewportZoomFix(): () => void {
  if (isInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // 1. On focusin of any input/textarea/select, ensure viewport scale constraints are active
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.getAttribute('contenteditable') === 'true';

    if (isField) {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover'
        );
      }
    }
  };

  // 2. On focusout, reset zoom and restore viewport scale
  const handleFocusOut = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.getAttribute('contenteditable') === 'true';

    if (isField) {
      // Immediate reset tick
      setTimeout(() => {
        const active = document.activeElement;
        const stillInField =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT');

        if (!stillInField) {
          forceResetViewportZoom();
        }
      }, 50);

      // Follow-up reset tick when keyboard finishes sliding off screen
      setTimeout(() => {
        forceResetViewportZoom();
      }, 250);
    }
  };

  // 3. User clicks Enter on mobile keyboard -> dismiss keyboard and reset zoom
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') {
        const input = target as HTMLInputElement;
        if (input.type !== 'submit' && input.type !== 'button') {
          // Blur input to dismiss mobile keyboard on iPhone and Android
          input.blur();
          // Reset viewport zoom
          forceResetViewportZoom();
        }
      }
    }
  };

  // 4. Monitor visualViewport resize (virtual keyboard hide/show on iOS Safari and Android Chrome)
  let lastHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const handleViewportResize = () => {
    if (!window.visualViewport) return;
    const currentHeight = window.visualViewport.height;

    // If height expanded by more than 50px, the virtual keyboard just went off!
    if (currentHeight > lastHeight + 50) {
      forceResetViewportZoom();
    }
    lastHeight = currentHeight;
  };

  // 5. Monitor window resize (backup for Android browsers where visualViewport might not trigger)
  let lastWindowHeight = window.innerHeight;
  const handleWindowResize = () => {
    const currentWindowHeight = window.innerHeight;
    if (currentWindowHeight > lastWindowHeight + 50) {
      forceResetViewportZoom();
    }
    lastWindowHeight = currentWindowHeight;
  };

  // 6. Orientation change reset
  const handleOrientationChange = () => {
    setTimeout(forceResetViewportZoom, 200);
  };

  document.addEventListener('focusin', handleFocusIn, { passive: true });
  document.addEventListener('focusout', handleFocusOut, { passive: true });
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
  window.addEventListener('resize', handleWindowResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize, { passive: true });
  }

  // Return cleanup function
  return () => {
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleWindowResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleViewportResize);
    }
    isInitialized = false;
  };
}
