import React, { useState, useEffect } from 'react';
import { Smartphone, Wrench, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface LoadingIntroScreenProps {
  onComplete: () => void;
  minDurationMs?: number;
}

export const LoadingIntroScreen: React.FC<LoadingIntroScreenProps> = ({
  onComplete,
  minDurationMs = 2000,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [phase, setPhase] = useState<'booting' | 'diagnostics' | 'escrow' | 'ready'>('booting');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 250);
  };

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      if (pct < 30) {
        setPhase('booting');
      } else if (pct < 65) {
        setPhase('diagnostics');
      } else if (pct < 95) {
        setPhase('escrow');
      } else {
        setPhase('ready');
      }

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        // Begin smooth fade out
        setIsFadingOut(true);
        const fadeTimer = setTimeout(() => {
          onComplete();
        }, 450);
        return () => clearTimeout(fadeTimer);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [minDurationMs, onComplete]);

  return (
    <div
      id="fixhub-loading-intro"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Top skip action */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          id="loading-intro-skip-btn"
          onClick={handleSkip}
          className="text-[11px] font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Skip</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {/* Subtle ambient gradient spotlight (not cyber/neon, warm subtle slate) */}
      <div className="absolute w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none -top-12 -left-12" />
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none -bottom-12 -right-12" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center max-w-xs sm:max-w-sm px-6 text-center">
        {/* Animated Phone & Repair Badge SVG */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6 flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full drop-shadow-2xl"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="introBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              <linearGradient id="screenBoot" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>

              <linearGradient id="toolGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>

              {/* Screen sweep mask */}
              <linearGradient id="scanLine" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="50%" stopColor="white" stopOpacity="0.4" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Base Rounded Icon Container */}
            <rect
              x="6"
              y="6"
              width="108"
              height="108"
              rx="28"
              fill="url(#introBg)"
              stroke="#334155"
              strokeWidth="2.5"
            />

            {/* Smartphone Outer Shell */}
            <rect
              x="25"
              y="16"
              width="48"
              height="84"
              rx="10"
              fill="#090d16"
              stroke="#475569"
              strokeWidth="2.5"
            />

            {/* Smartphone Screen - Lights up on boot */}
            <rect
              x="29"
              y="23"
              width="40"
              height="66"
              rx="6"
              fill={phase === 'booting' && progress < 15 ? '#0b1120' : 'url(#screenBoot)'}
              className="transition-all duration-700 ease-out"
              opacity={phase === 'booting' && progress < 15 ? 0.4 : 0.95}
            />

            {/* Glass Screen Reflection / Scan Line */}
            {progress >= 20 && progress < 85 && (
              <rect
                x="29"
                y={23 + (progress % 50) * 1.1}
                width="40"
                height="14"
                fill="url(#scanLine)"
                className="transition-all duration-100"
              />
            )}

            {/* Speaker Earpiece Notch */}
            <rect x="42" y="19" width="14" height="2" rx="1" fill="#64748b" />
            {/* Phone Home Bar */}
            <rect x="43" y="85" width="12" height="2" rx="1" fill="#ffffff" opacity="0.6" />

            {/* Precision Diagnostic Wrench (Rotates and clicks into place) */}
            <g
              className="transition-transform duration-500 ease-out"
              style={{
                transform: `rotate(${progress < 30 ? -55 : -35}deg) scale(${
                  progress < 25 ? 0.8 : 1
                })`,
                transformOrigin: '60px 55px',
                opacity: progress < 20 ? 0.3 : 1,
              }}
            >
              {/* Wrench Shaft */}
              <rect
                x="53"
                y="36"
                width="8.5"
                height="38"
                rx="4"
                fill="url(#toolGrad)"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
              />
              <rect x="56" y="42" width="2.5" height="24" rx="1.25" fill="#475569" opacity="0.5" />
            </g>

            {/* Escrow Shield & Lock (Pops in during escrow phase) */}
            <g
              className="transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
              style={{
                transform: `translate(62px, 57px) scale(${progress < 55 ? 0.5 : 1})`,
                opacity: progress < 50 ? 0 : 1,
              }}
            >
              {/* Outer Shield Backing */}
              <path
                d="M 22 2 L 42 8 C 42 27 29 41 22 46 C 15 41 2 27 2 8 Z"
                fill="#062217"
                opacity="0.95"
              />
              {/* Shield Body */}
              <path
                d="M 22 4 L 40 10 C 40 25 28 38 22 43 C 16 38 4 25 4 10 Z"
                fill="url(#shieldGrad)"
                stroke="#34d399"
                strokeWidth="2"
              />
              {/* Lock Shackle */}
              <path
                d="M 18 19 L 18 15 C 18 12.8 19.8 11 22 11 C 24.2 11 26 12.8 26 15 L 26 19"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Lock Case */}
              <rect x="15" y="19" width="14" height="11" rx="2.5" fill="#ffffff" />
              <circle cx="22" cy="23.5" r="1.5" fill="#047857" />
              <path
                d="M 22 24.5 L 22 27.5"
                stroke="#047857"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>

        {/* Brand Name Typography */}
        <div className="flex flex-col items-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center">
            FIX<span className="text-emerald-400">HUB</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mt-1">
            Phone Repair & Protection
          </p>
        </div>

        {/* Dynamic Status Text */}
        <div className="h-9 mt-4 flex items-center justify-center">
          <p className="text-xs text-slate-300 font-medium tracking-normal transition-opacity duration-200">
            {phase === 'booting' && 'Powering device diagnostics...'}
            {phase === 'diagnostics' && 'Connecting to verified repair hubs...'}
            {phase === 'escrow' && 'Securing Paystack payment guarantee...'}
            {phase === 'ready' && 'Find. Fix. Done.'}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full mt-2 bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden shadow-inner relative">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 rounded-full transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percent & Location Badge */}
        <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2 px-1">
          <span>Port Harcourt, Rivers State</span>
          <span className="text-emerald-400 font-bold">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
