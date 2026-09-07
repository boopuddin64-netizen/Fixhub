import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react';

interface GestureContainerProps {
  children: React.ReactNode;
  onBack?: () => void;
  onRefresh?: () => Promise<void> | void;
  canGoBack?: boolean;
}

export const GestureContainer: React.FC<GestureContainerProps> = ({
  children,
  onBack,
  onRefresh,
  canGoBack = true,
}) => {
  // Touch tracking state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isEligibleForPullRef = useRef<boolean>(false);
  const isEligibleForBackRef = useRef<boolean>(false);
  const isLockedHorizontalRef = useRef<boolean>(false);
  const isLockedVerticalRef = useRef<boolean>(false);

  // Visual indicators
  const [swipeRightDistance, setSwipeRightDistance] = useState<number>(0);
  const [pullDownDistance, setPullDownDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshComplete, setRefreshComplete] = useState<boolean>(false);

  const BACK_THRESHOLD = 75; // px to trigger back
  const REFRESH_THRESHOLD = 75; // px to trigger pull-to-refresh

  // Helper to check if touch started inside an interactive element that shouldn't swipe
  const isIgnoredTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return !!(
      target.closest('input[type="range"]') ||
      target.closest('.gm-style') || // Google Maps canvas
      target.closest('[data-no-swipe="true"]') ||
      target.closest('textarea') ||
      target.closest('input[type="text"]')
    );
  };

  // Helper to check if page/container is scrolled to the top
  const isAtScrollTop = (): boolean => {
    if (window.scrollY > 2) return false;
    const scrollableContainers = document.querySelectorAll('.overflow-y-auto');
    for (let i = 0; i < scrollableContainers.length; i++) {
      if (scrollableContainers[i].scrollTop > 2) {
        return false;
      }
    }
    return true;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (isIgnoredTarget(e.target)) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    isEligibleForPullRef.current = isAtScrollTop();
    // Swipe right is eligible from anywhere or predominantly left half
    isEligibleForBackRef.current = canGoBack && !!onBack;
    isLockedHorizontalRef.current = false;
    isLockedVerticalRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Lock direction once movement is detected
    if (!isLockedHorizontalRef.current && !isLockedVerticalRef.current) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        isLockedHorizontalRef.current = true;
      } else if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        isLockedVerticalRef.current = true;
      }
    }

    // Handle Swipe Right for Back
    if (isLockedHorizontalRef.current && isEligibleForBackRef.current && deltaX > 0) {
      const dampenedX = Math.min(130, Math.pow(deltaX, 0.92));
      setSwipeRightDistance(dampenedX);
      setPullDownDistance(0);
    }

    // Handle Swipe Down for Refresh
    if (
      isLockedVerticalRef.current &&
      isEligibleForPullRef.current &&
      deltaY > 0 &&
      !isRefreshing &&
      !!onRefresh
    ) {
      const dampenedY = Math.min(120, Math.pow(deltaY, 0.88));
      setPullDownDistance(dampenedY);
      setSwipeRightDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    const wasSwipingRight = swipeRightDistance >= BACK_THRESHOLD;
    const wasPullingDown = pullDownDistance >= REFRESH_THRESHOLD;

    // Reset visual touch tracking
    touchStartRef.current = null;
    isEligibleForPullRef.current = false;
    isEligibleForBackRef.current = false;
    isLockedHorizontalRef.current = false;
    isLockedVerticalRef.current = false;
    setSwipeRightDistance(0);

    // Trigger Back if threshold passed
    if (wasSwipingRight && onBack) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(15);
        } catch {
          // ignore
        }
      }
      onBack();
      return;
    }

    // Trigger Refresh if threshold passed
    if (wasPullingDown && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      setPullDownDistance(65); // Keep docked during refresh

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(15);
        } catch {
          // ignore
        }
      }

      try {
        await Promise.resolve(onRefresh());
        setRefreshComplete(true);
        setTimeout(() => {
          setRefreshComplete(false);
          setIsRefreshing(false);
          setPullDownDistance(0);
        }, 600);
      } catch (err) {
        console.error('Pull to refresh failed:', err);
        setIsRefreshing(false);
        setPullDownDistance(0);
      }
    } else {
      setPullDownDistance(0);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* 1. Pull-Down for Refresh Top Indicator Bar */}
      {(pullDownDistance > 0 || isRefreshing) && (
        <div
          id="pull-to-refresh-indicator"
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none transition-transform duration-100 ease-out"
          style={{
            transform: `translateY(${Math.max(12, pullDownDistance - 18)}px)`,
          }}
        >
          <div
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full shadow-xl border text-xs font-bold transition-all duration-200 backdrop-blur-md ${
              refreshComplete
                ? 'bg-emerald-600 text-white border-emerald-500'
                : pullDownDistance >= REFRESH_THRESHOLD || isRefreshing
                ? 'bg-slate-900 text-cyan-300 border-cyan-500/50 shadow-cyan-900/30'
                : 'bg-slate-900/90 text-slate-300 border-slate-700'
            }`}
          >
            {refreshComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Updated!</span>
              </>
            ) : isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>Refreshing repairs & quotes...</span>
              </>
            ) : (
              <>
                <RefreshCw
                  className="w-4 h-4 transition-transform duration-200"
                  style={{
                    transform: `rotate(${Math.min(
                      180,
                      (pullDownDistance / REFRESH_THRESHOLD) * 180
                    )}deg)`,
                  }}
                />
                <span>
                  {pullDownDistance >= REFRESH_THRESHOLD
                    ? 'Release to refresh'
                    : 'Pull down to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Swipe Right for Back Left Edge Indicator */}
      {swipeRightDistance > 12 && canGoBack && (
        <div
          id="swipe-back-indicator"
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none flex items-center transition-all duration-75 ease-out"
          style={{
            transform: `translate3d(${Math.max(0, swipeRightDistance - 40)}px, -50%, 0)`,
          }}
        >
          <div
            className={`flex items-center gap-2 py-3 px-4 rounded-r-2xl shadow-2xl border-y border-r transition-all duration-150 backdrop-blur-md ${
              swipeRightDistance >= BACK_THRESHOLD
                ? 'bg-emerald-600 text-white border-emerald-400 scale-105 shadow-emerald-950/40'
                : 'bg-slate-900/95 text-slate-200 border-slate-700 shadow-slate-950/40'
            }`}
          >
            <ArrowLeft
              className={`w-5 h-5 transition-transform duration-150 ${
                swipeRightDistance >= BACK_THRESHOLD ? 'translate-x-[-2px]' : ''
              }`}
            />
            <span className="text-xs font-bold">
              {swipeRightDistance >= BACK_THRESHOLD ? 'Release for Back' : 'Back'}
            </span>
          </div>
        </div>
      )}

      {/* App Content */}
      <div className="flex-1 flex flex-col w-full">{children}</div>
    </div>
  );
};
