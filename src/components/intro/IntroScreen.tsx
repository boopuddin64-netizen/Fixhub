import React, { useState } from 'react';
import { FixhubLogo } from '../common/FixhubLogo';
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Lock,
  Clock,
  ArrowRight,
  Wrench,
  UserCheck,
  Award,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';

interface IntroScreenProps {
  onComplete: (preferredRole?: 'customer' | 'technician') => void;
  canDismiss?: boolean;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete, canDismiss = true }) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  const steps = [
    {
      step: '1',
      title: 'Choose your phone & issue',
      description:
        'Tell us what is wrong with your phone — cracked screen, faulty charging port, weak battery, or water damage.',
      badge: 'Transparent Quotes',
      icon: Smartphone,
      iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      highlights: [
        'Select iPhone, Samsung, Tecno, Infinix, Pixel & more',
        'Upload photo or short description of the damage',
        'Compare nearby quotes without moving from your seat',
      ],
    },
    {
      step: '2',
      title: 'Your payment is 100% protected',
      description:
        'You never pay the technician upfront. Your money is secured safely by Fixhub until you personally test and verify your fixed phone.',
      badge: '100% Payment Protected',
      icon: ShieldCheck,
      iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      highlights: [
        'Zero risk of lost money or unfinished repair jobs',
        'Funds are released ONLY after you inspect your phone',
        'Dispute protection if parts are not as agreed',
      ],
    },
    {
      step: '3',
      title: 'Drop off with PIN & 30-day warranty',
      description:
        'Drop your phone at a verified workshop in Port Harcourt using your private security code. Get a 30-day warranty on every repair.',
      badge: 'Verified & Warrantied',
      icon: Lock,
      iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      highlights: [
        'Private 4-digit drop-off & pickup PIN prevents part tampering',
        'Vetted physical shops (Garrison, Aba Road, Rumuokoro, Choba)',
        'Free 30-day warranty with digital repair passport',
      ],
    },
  ];

  return (
    <div
      id="fixhub-intro-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Navigation */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <FixhubLogo size="md" theme="dark" variant="full" />

          {canDismiss && (
            <button
              id="intro-skip-btn"
              onClick={() => onComplete('customer')}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Skip to app →
            </button>
          )}
        </div>

        {/* Hero Title & Value Proposition */}
        <div className="p-5 sm:p-6 pb-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
            <MapPin className="w-3.5 h-3.5" />
            <span>Port Harcourt & Rivers State Phone Repair</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            Get your phone fixed safely.
            <br />
            <span className="text-emerald-400">No stress. No part swapping.</span>
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Connect with verified local phone repair technicians. Your payment is held securely
            and only released after you test your repaired device.
          </p>
        </div>

        {/* 3 Step Interactive / Scannable Cards */}
        <div className="p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50 mb-4">
            {steps.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === idx
                    ? 'bg-slate-900 text-white shadow-xs border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    activeTab === idx ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {s.step}
                </span>
                <span className="truncate hidden sm:inline">{idx === 0 ? 'Request' : idx === 1 ? 'Protected' : 'Warranty'}</span>
              </button>
            ))}
          </div>

          {/* Active Step Feature Box */}
          {(() => {
            const cur = steps[activeTab];
            const Icon = cur.icon;
            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/70 relative">
                <div className="flex items-start gap-3.5">
                  <div className={`p-3 rounded-xl border shrink-0 ${cur.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-white">{cur.title}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-700 text-emerald-300 border border-slate-600">
                        {cur.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{cur.description}</p>
                  </div>
                </div>

                {/* Highlights Checklist */}
                <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2">
                  {cur.highlights.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeTab === i ? 'w-6 bg-emerald-400' : 'w-2 bg-slate-700'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Local Trust Guarantee & Action Buttons */}
        <div className="p-4 sm:p-6 bg-slate-950/60 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>30-Day Repair Guarantee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Tested Before Release</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              id="intro-get-started-customer-btn"
              onClick={() => onComplete('customer')}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <span>Get Started — Find a Repair Shop</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="intro-technician-portal-btn"
              onClick={() => onComplete('technician')}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-colors cursor-pointer border border-slate-700"
            >
              I am a Phone Technician
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
