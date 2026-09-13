import React, { useRef, useEffect } from 'react';

export interface ScrollPickerItem {
  label: string;
  value: string;
  active?: boolean;
}

interface ScrollPickerProps {
  id?: string;
  items: ScrollPickerItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onDisabledSelect?: (label: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
  ariaLabel?: string;
}

export const ScrollPicker: React.FC<ScrollPickerProps> = ({
  id,
  items,
  selectedValue,
  onSelect,
  onDisabledSelect,
  disabled = false,
  disabledMessage = 'Select state first',
  ariaLabel = 'Picker',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to selected item on mount or when selectedValue changes
  useEffect(() => {
    if (!containerRef.current || disabled) return;
    const selectedIndex = items.findIndex((item) => item.value === selectedValue);
    if (selectedIndex >= 0) {
      const itemHeight = 40; // 40px per item
      containerRef.current.scrollTo({
        top: selectedIndex * itemHeight,
        behavior: 'smooth',
      });
    }
  }, [selectedValue, disabled, items]);

  if (disabled) {
    return (
      <div
        id={id}
        className="relative h-36 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-500 text-xs select-none"
      >
        <span className="italic">{disabledMessage}</span>
      </div>
    );
  }

  return (
    <div
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      className="relative h-36 rounded-xl border border-slate-700/80 bg-slate-900/90 overflow-hidden select-none focus-within:ring-2 focus-within:ring-blue-500/50"
    >
      {/* Center Selection Lens Highlight */}
      <div className="absolute top-[48px] left-2 right-2 h-10 rounded-lg bg-blue-500/10 border-y border-blue-500/30 pointer-events-none z-10" />

      {/* Top and Bottom Vignette Masks for Roller Wheel 3D Effect */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-900 via-slate-900/80 to-transparent pointer-events-none z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-none z-20" />

      {/* Scrollable Container with Snap */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="h-full overflow-y-auto snap-y snap-mandatory py-[48px] scroll-smooth no-scrollbar focus:outline-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const isSelected = item.value === selectedValue;
          const isActive = item.active !== false;

          return (
            <div
              key={item.value}
              role="option"
              aria-selected={isSelected}
              aria-disabled={!isActive}
              onClick={() => {
                if (isActive) {
                  onSelect(item.value);
                } else if (onDisabledSelect) {
                  onDisabledSelect(item.label);
                }
              }}
              className={`h-10 snap-center flex items-center justify-center px-4 text-center transition-all duration-150 ${
                !isActive
                  ? 'text-slate-600 opacity-40 cursor-not-allowed hover:bg-red-500/5'
                  : isSelected
                  ? 'text-blue-400 font-extrabold text-sm scale-105'
                  : 'text-slate-300 font-medium text-xs hover:text-white cursor-pointer hover:bg-slate-800/40'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {!isActive && (
                <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-500 font-normal">
                  Unavailable
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
