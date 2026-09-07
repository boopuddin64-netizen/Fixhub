import React from 'react';

interface FixhubLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'mark-only';
  theme?: 'dark' | 'light';
  showTagline?: boolean;
  className?: string;
}

export const FixhubLogo: React.FC<FixhubLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'dark',
  showTagline = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const titleSize = {
    sm: 'text-base font-extrabold tracking-tight',
    md: 'text-lg font-black tracking-tight',
    lg: 'text-2xl font-black tracking-tight',
    xl: 'text-3xl font-black tracking-tight',
  }[size];

  const taglineSize = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  const isLight = theme === 'light';

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Brandmark Icon SVG */}
      <div
        className={`${iconDimensions} rounded-2xl shrink-0 overflow-hidden shadow-xs relative flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="fhCompBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="fhCompScreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="60%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="fhCompShield" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="fhCompTool" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {/* Background Card */}
          <rect
            x="4"
            y="4"
            width="112"
            height="112"
            rx="28"
            fill="url(#fhCompBg)"
            stroke="#334155"
            strokeWidth="2.5"
          />

          {/* Phone Silhouette */}
          <rect
            x="24"
            y="16"
            width="50"
            height="86"
            rx="11"
            fill="#0b1120"
            stroke="#475569"
            strokeWidth="2.5"
          />
          {/* Glowing Screen */}
          <rect
            x="28"
            y="24"
            width="42"
            height="68"
            rx="6"
            fill="url(#fhCompScreen)"
            opacity="0.95"
          />
          {/* Speaker Earpiece */}
          <rect x="42" y="19" width="14" height="2.5" rx="1.25" fill="#64748b" />
          {/* Home indicator */}
          <rect x="42" y="86" width="14" height="2" rx="1" fill="#ffffff" opacity="0.6" />

          {/* Precision Diagnostic Repair Wrench */}
          <g transform="rotate(-35 60 55)">
            <rect
              x="53"
              y="36"
              width="8.5"
              height="38"
              rx="4"
              fill="url(#fhCompTool)"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
            />
            <rect x="56" y="42" width="2.5" height="24" rx="1.25" fill="#475569" opacity="0.5" />
          </g>

          {/* Green Escrow Shield */}
          <g transform="translate(62, 57)">
            <path
              d="M 22 2 L 42 8 C 42 27 29 41 22 46 C 15 41 2 27 2 8 Z"
              fill="#062217"
              opacity="0.9"
            />
            <path
              d="M 22 4 L 40 10 C 40 25 28 38 22 43 C 16 38 4 25 4 10 Z"
              fill="url(#fhCompShield)"
              stroke="#34d399"
              strokeWidth="2"
            />
            {/* Padlock */}
            <path
              d="M 18 19 L 18 15 C 18 12.8 19.8 11 22 11 C 24.2 11 26 12.8 26 15 L 26 19"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <rect x="15" y="19" width="14" height="11" rx="2.5" fill="#ffffff" />
            <circle cx="22" cy="23.5" r="1.5" fill="#047857" />
            <path d="M 22 24.5 L 22 27.5" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* Brand Typography & Niche Tagline */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`${titleSize} ${isLight ? 'text-slate-900' : 'text-white'}`}>
              FIX<span className="text-emerald-500">HUB</span>
            </span>
          </div>
          {showTagline && (
            <p
              className={`${taglineSize} ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              } font-medium tracking-normal mt-0.5`}
            >
              Phone Repair & Escrow
            </p>
          )}
        </div>
      )}
    </div>
  );
};
