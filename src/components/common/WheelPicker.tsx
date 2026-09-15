import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

export interface WheelPickerOption<T = string | number> {
  label: string;
  value: T;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
  active?: boolean;
}

// Backward compatibility alias for ScrollPickerItem
export type ScrollPickerItem = WheelPickerOption<string>;

export interface WheelPickerProps<T = string | number> {
  id?: string;
  options?: WheelPickerOption<T>[];
  items?: WheelPickerOption<T>[]; // Backward compatibility alias
  value?: T;
  selectedValue?: T; // Backward compatibility alias
  onChange?: (value: T) => void;
  onSelect?: (value: T) => void; // Backward compatibility alias
  onDisabledSelect?: (label: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
  itemHeight?: number; // default 44px
  visibleCount?: number; // default 5 items
  theme?: 'dark' | 'light' | 'auto';
  unit?: string;
  ariaLabel?: string;
  className?: string;
  enableHaptics?: boolean;
}

// Backward compatibility alias for ScrollPickerProps
export type ScrollPickerProps = WheelPickerProps<string>;

/**
 * Trigger lightweight native device haptic tick (iOS / Android supported Web Vibration)
 */
function triggerHapticTick() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(10);
    } catch {
      // Gracefully ignore if disabled by browser policies
    }
  }
}

export function WheelPicker<T = string | number>({
  id,
  options,
  items,
  value,
  selectedValue,
  onChange,
  onSelect,
  onDisabledSelect,
  disabled = false,
  disabledMessage = 'No options available',
  itemHeight = 44,
  visibleCount = 5,
  theme = 'auto',
  unit,
  ariaLabel = 'Wheel selection',
  className = '',
  enableHaptics = true,
}: WheelPickerProps<T>): React.ReactElement {
  // Normalize options and callbacks
  const rawList = options || items || [];
  const activeValue = value !== undefined ? value : selectedValue;
  const handleSelect = onChange || onSelect;

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const lastHapticIndexRef = useRef<number>(-1);
  const [scrollTop, setScrollTop] = useState<number>(0);

  // Pad count above and below center item
  const padCount = Math.floor(visibleCount / 2);
  const totalHeight = visibleCount * itemHeight;
  const centerLensTop = padCount * itemHeight;

  // Selected Index resolution
  const selectedIndex = useMemo(() => {
    if (activeValue === undefined) return 0;
    const idx = rawList.findIndex((opt) => opt.value === activeValue);
    return idx >= 0 ? idx : 0;
  }, [rawList, activeValue]);

  // Sync scroll position with selected value on mount or external change
  useEffect(() => {
    if (!containerRef.current || disabled || isUserScrollingRef.current) return;
    const targetScroll = selectedIndex * itemHeight;
    if (Math.abs(containerRef.current.scrollTop - targetScroll) > 1) {
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
      setScrollTop(targetScroll);
      lastHapticIndexRef.current = selectedIndex;
    }
  }, [selectedIndex, itemHeight, disabled]);

  // Handle scroll events with RAF / debounced snap confirmation
  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const currentScroll = e.currentTarget.scrollTop;
      setScrollTop(currentScroll);
      isUserScrollingRef.current = true;

      // Calculate nearest index
      const rawIndex = Math.round(currentScroll / itemHeight);
      const clampedIndex = Math.max(0, Math.min(rawIndex, rawList.length - 1));

      // Trigger one haptic tick per new item encountered
      if (clampedIndex !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = clampedIndex;
        if (enableHaptics) {
          triggerHapticTick();
        }
      }

      // Debounce the final snap commit
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        const finalOption = rawList[clampedIndex];
        if (finalOption && finalOption.disabled !== true && finalOption.active !== false) {
          if (handleSelect && finalOption.value !== activeValue) {
            handleSelect(finalOption.value);
          }
        }
      }, 90);
    },
    [itemHeight, rawList, enableHaptics, handleSelect, activeValue]
  );

  // Click direct item to smoothly center & select
  const handleItemClick = (index: number, opt: WheelPickerOption<T>) => {
    if (disabled) return;
    if (opt.disabled === true || opt.active === false) {
      if (onDisabledSelect) {
        onDisabledSelect(opt.label);
      }
      return;
    }

    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth',
      });
    }
    if (enableHaptics) {
      triggerHapticTick();
    }
    if (handleSelect) {
      handleSelect(opt.value);
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || rawList.length === 0) return;

    let targetIdx = selectedIndex;

    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      targetIdx = Math.max(0, selectedIndex - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      targetIdx = Math.min(rawList.length - 1, selectedIndex + 1);
    } else if (e.key === 'Home' || e.key === 'PageUp') {
      e.preventDefault();
      targetIdx = 0;
    } else if (e.key === 'End' || e.key === 'PageDown') {
      e.preventDefault();
      targetIdx = rawList.length - 1;
    } else {
      return;
    }

    const opt = rawList[targetIdx];
    if (opt && opt.disabled !== true && opt.active !== false) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: targetIdx * itemHeight,
          behavior: 'smooth',
        });
      }
      if (enableHaptics) {
        triggerHapticTick();
      }
      if (handleSelect) {
        handleSelect(opt.value);
      }
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Theme-specific styling classes
  const isDark = theme === 'dark' || (theme === 'auto' && true); // standard dark styling by default for auth/modals or clean dark

  if (disabled) {
    return (
      <div
        id={id}
        className={`relative rounded-2xl border flex items-center justify-center text-xs select-none transition-all ${
          isDark
            ? 'border-slate-800 bg-slate-900/60 text-slate-500'
            : 'border-slate-200 bg-slate-100/70 text-slate-400'
        } ${className}`}
        style={{ height: `${totalHeight}px` }}
      >
        <span className="italic">{disabledMessage}</span>
      </div>
    );
  }

  return (
    <div
      id={id}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      style={{ height: `${totalHeight}px` }}
      className={`relative rounded-2xl border overflow-hidden select-none outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        isDark
          ? 'border-slate-800 bg-slate-950/90 text-slate-200'
          : 'border-slate-200/90 bg-white text-slate-900 shadow-2xs'
      } ${className}`}
    >
      {/* Centered iOS Selection Lens Highlight */}
      <div
        style={{
          top: `${centerLensTop}px`,
          height: `${itemHeight}px`,
        }}
        className={`absolute left-2 right-2 rounded-xl pointer-events-none z-10 transition-colors ${
          isDark
            ? 'bg-blue-500/10 border-y border-blue-400/25 shadow-xs shadow-blue-500/5'
            : 'bg-blue-50/80 border-y border-blue-500/25 shadow-xs shadow-blue-500/5'
        }`}
      />

      {/* Unit label if provided (e.g. "km" or "days" pinned right of center) */}
      {unit && (
        <div
          style={{
            top: `${centerLensTop}px`,
            height: `${itemHeight}px`,
          }}
          className="absolute right-4 flex items-center pointer-events-none z-20"
        >
          <span className="text-xs font-black uppercase tracking-wider text-blue-500/80">{unit}</span>
        </div>
      )}

      {/* Top and Bottom 3D Cylinder Vignette Depth Overlays */}
      <div
        className={`absolute top-0 left-0 right-0 pointer-events-none z-20 ${
          isDark
            ? 'bg-gradient-to-b from-slate-950 via-slate-950/85 to-transparent'
            : 'bg-gradient-to-b from-white via-white/85 to-transparent'
        }`}
        style={{ height: `${centerLensTop}px` }}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 pointer-events-none z-20 ${
          isDark
            ? 'bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent'
            : 'bg-gradient-to-t from-white via-white/85 to-transparent'
        }`}
        style={{ height: `${centerLensTop}px` }}
      />

      {/* Smooth Touch / Scroll Container */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{
          paddingTop: `${centerLensTop}px`,
          paddingBottom: `${centerLensTop}px`,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          perspective: '1000px',
        }}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
      >
        {rawList.map((option, index) => {
          const isSelected = option.value === activeValue;
          const isItemActive = option.disabled !== true && option.active !== false;

          // Compute distance from center for iOS 3D depth curvature
          const itemScrollPos = index * itemHeight;
          const distFromCenter = (itemScrollPos - scrollTop) / itemHeight;
          const absDist = Math.abs(distFromCenter);

          // 3D Apple-style barrel rotation and scale
          const rotateAngle = Math.max(-65, Math.min(65, distFromCenter * -20));
          const scale = Math.max(0.85, 1 - absDist * 0.05);
          const opacity = Math.max(0.25, 1 - absDist * 0.32);

          return (
            <div
              key={`${option.value}-${index}`}
              role="option"
              aria-selected={isSelected}
              aria-disabled={!isItemActive}
              onClick={() => handleItemClick(index, option)}
              style={{
                height: `${itemHeight}px`,
                transform: `rotateX(${rotateAngle}deg) scale(${scale})`,
                opacity: isItemActive ? opacity : 0.3,
                transformOrigin: distFromCenter > 0 ? 'center top' : 'center bottom',
              }}
              className={`snap-center flex items-center justify-center px-4 text-center cursor-pointer transition-transform duration-75 select-none ${
                !isItemActive
                  ? 'cursor-not-allowed text-slate-500'
                  : isSelected
                  ? isDark
                    ? 'text-blue-400 font-extrabold text-sm'
                    : 'text-blue-600 font-extrabold text-sm'
                  : isDark
                  ? 'text-slate-400 font-medium text-xs hover:text-slate-200'
                  : 'text-slate-600 font-medium text-xs hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate max-w-full">
                <span className="truncate">{option.label}</span>
                {option.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-400'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {option.badge}
                  </span>
                )}
                {!isItemActive && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-500 font-normal">
                    Unavailable
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Re-export standard component names
export const IOSWheelPicker = WheelPicker;
