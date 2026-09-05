import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Smartphone,
  Wrench,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  LogOut
} from 'lucide-react';

interface WorkflowProgressRibbonProps {
  currentTab: string;
  onNavigateTab: (tab: any) => void;
  onRestartOnboarding: () => void;
}

export const WorkflowProgressRibbon: React.FC<WorkflowProgressRibbonProps> = ({
  currentTab,
  onNavigateTab,
  onRestartOnboarding,
}) => {
  const { user, role, logout } = useAuth();

  if (!user) return null;

  const isCustomer = role === 'customer';

  return (
    <div id="workflow-progress-ribbon" className="bg-slate-900 border-b border-slate-800 text-xs px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Role & Active Workflow Tracker */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-bold">
            {isCustomer ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-300">Customer Flow:</span>
              </>
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-300">Technician Store Flow:</span>
              </>
            )}
            <span className="text-white">{user.name}</span>
          </div>

          {/* Workflow Step Chips */}
          {isCustomer ? (
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px]">
              <button
                onClick={() => onNavigateTab('home')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'home'
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                1. Request Repair
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('quotes')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'quotes'
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                2. Quotes & Escrow
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('tracking')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'tracking'
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                3. Live Tracker & Intake
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('warranties')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'warranties'
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                4. Warranty Passport
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px]">
              <button
                onClick={() => onNavigateTab('store_setup')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'store_setup'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                1. Store Setup & Bank
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('parts')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'parts'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                2. Parts Catalog
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('dashboard')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                3. Workbench & Leads
              </button>
              <span className="text-slate-600">→</span>
              <button
                onClick={() => onNavigateTab('profile')}
                className={`px-2 py-0.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                4. Payouts & Profile
              </button>
            </div>
          )}
        </div>

        {/* Right: Switch Role & Logout Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={logout}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all"
            title="Log out and return to the login / registration switch screen"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Switch Role / Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
