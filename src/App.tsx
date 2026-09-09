import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { WorkflowProgressRibbon } from './components/common/WorkflowProgressRibbon';
import { AuthAndOnboardingGateway } from './components/auth/AuthAndOnboardingGateway';
import { CustomerHomeView } from './components/customer/CustomerHomeView';
import { RepairRequestWizard } from './components/customer/RepairRequestWizard';
import { SavedDevicesManager } from './components/customer/SavedDevicesManager';
import { QuoteComparisonView } from './components/customer/QuoteComparisonView';
import { ActiveRepairTracker } from './components/customer/ActiveRepairTracker';
import { EscrowPaymentModal } from './components/customer/EscrowPaymentModal';
import { VerifiedReviewModal } from './components/customer/VerifiedReviewModal';
import { WarrantyPassportView } from './components/customer/WarrantyPassportView';
import { CustomerProfileView } from './components/customer/CustomerProfileView';
import { CustomerRepairsView } from './components/repairs/CustomerRepairsView';
import { TechnicianDiscoveryView } from './components/customer/technician-discovery/TechnicianDiscoveryView';
import { TechnicianDashboardView } from './components/technician/TechnicianDashboardView';
import { TechnicianJobWorkspace } from './components/technician/TechnicianJobWorkspace';
import { TechnicianStoreSetupView } from './components/technician/TechnicianStoreSetupView';
import { PartsCatalogView } from './components/technician/PartsCatalogView';
import { TechnicianProfileView } from './components/technician/TechnicianProfileView';
import { RepairChatDrawer } from './components/messaging/RepairChatDrawer';
import { GoogleMapsProvider } from './components/maps/GoogleMapsProvider';
import { IntroScreen } from './components/intro/IntroScreen';
import { LoadingIntroScreen } from './components/common/LoadingIntroScreen';
import { GestureContainer } from './components/common/GestureContainer';
import { ApiClient } from './api/client';
import { RepairJob, RepairRequest, RepairQuote, NotificationItem, TechnicianProfile, CustomerDevice } from './types';
import { Wrench, Plus, Sparkles, AlertCircle, Clock } from 'lucide-react';

function MainAppContent() {
  const { user, role, logout } = useAuth();

  // Fresh-start loading screen animation state
  const [isLoadingIntro, setIsLoadingIntro] = useState<boolean>(true);
  const [showIntroGuide, setShowIntroGuide] = useState<boolean>(false);
  const [preferredInitialRole, setPreferredInitialRole] = useState<'customer' | 'technician'>('customer');

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [showDevicesManager, setShowDevicesManager] = useState<boolean>(false);
  const [wizardPrefill, setWizardPrefill] = useState<{
    device?: CustomerDevice;
    brand?: string;
    model?: string;
    issue?: string;
  } | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>('job_demo_active');
  const [paymentTarget, setPaymentTarget] = useState<{ job: RepairJob; quote: RepairQuote } | null>(null);

  // Chat & Notifications Drawers
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isNotifsOpen, setIsNotifsOpen] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

  // Data Store
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);

  const loadData = useCallback(async () => {
    try {
      if (!user) {
        const techList = await ApiClient.getTechnicians().catch(() => []);
        setTechnicians(techList);
        return;
      }

      const [jobList, reqList, notifList, techList] = await Promise.all([
        ApiClient.getJobs().catch(() => []),
        ApiClient.getRepairRequests().catch(() => []),
        ApiClient.getNotifications().catch(() => []),
        ApiClient.getTechnicians().catch(() => []),
      ]);
      setJobs(Array.isArray(jobList) ? jobList : []);
      setRequests(Array.isArray(reqList) ? reqList : []);
      setNotifications(Array.isArray(notifList) ? notifList : []);
      setTechnicians(Array.isArray(techList) ? techList : []);
    } catch (err) {
      console.error('Failed to load application state:', err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!user) {
      setJobs([]);
      setRequests([]);
      setNotifications([]);
    }
  }, [user]);

  // Adjust default tab when switching roles
  useEffect(() => {
    if (role === 'technician') {
      setCurrentTab('dashboard');
    } else {
      setCurrentTab('home');
    }
  }, [role]);

  // Gesture Back Handler (Swipe right)
  const canGoBack =
    showIntroGuide ||
    isChatOpen ||
    isNotifsOpen ||
    !!paymentTarget ||
    showReviewModal ||
    showDevicesManager ||
    showWizard ||
    currentTab === 'discovery' ||
    currentTab === 'quotes' ||
    (role === 'technician' && currentTab !== 'dashboard') ||
    (role === 'customer' && currentTab !== 'home');

  const handleBack = useCallback(() => {
    // Check if any child component wants to intercept and handle the back navigation (e.g. wizard step back)
    const customEvent = new CustomEvent('fixhub:navigate-back', { cancelable: true });
    const wasCancelled = !window.dispatchEvent(customEvent);
    if (wasCancelled) {
      return;
    }

    if (showIntroGuide) {
      setShowIntroGuide(false);
      return;
    }
    if (isChatOpen) {
      setIsChatOpen(false);
      return;
    }
    if (isNotifsOpen) {
      setIsNotifsOpen(false);
      return;
    }
    if (paymentTarget) {
      setPaymentTarget(null);
      return;
    }
    if (showReviewModal) {
      setShowReviewModal(false);
      return;
    }
    if (showDevicesManager) {
      setShowDevicesManager(false);
      return;
    }
    if (showWizard) {
      setShowWizard(false);
      setWizardPrefill(null);
      return;
    }
    if (currentTab === 'discovery') {
      setCurrentTab('repairs');
      return;
    }
    if (currentTab === 'quotes') {
      setCurrentTab('home');
      return;
    }
    if (role === 'technician') {
      if (currentTab !== 'dashboard') {
        setCurrentTab('dashboard');
      }
    } else {
      if (currentTab !== 'home') {
        setCurrentTab('home');
      }
    }
  }, [
    showIntroGuide,
    isChatOpen,
    isNotifsOpen,
    paymentTarget,
    showReviewModal,
    showDevicesManager,
    showWizard,
    currentTab,
    role,
  ]);

  // If user is unauthenticated, show the complete Split Onboarding & Registration Screen or Fresh Intro
  if (!user) {
    return (
      <GestureContainer
        onBack={showIntroGuide ? () => setShowIntroGuide(false) : undefined}
        onRefresh={loadData}
        canGoBack={showIntroGuide}
      >
        {/* Fresh Start Loading Screen Animation */}
        {isLoadingIntro && (
          <LoadingIntroScreen
            onComplete={() => setIsLoadingIntro(false)}
            minDurationMs={1900}
          />
        )}

        {showIntroGuide ? (
          <IntroScreen
            onComplete={(prefRole) => {
              setShowIntroGuide(false);
              if (prefRole) setPreferredInitialRole(prefRole);
            }}
          />
        ) : (
          <AuthAndOnboardingGateway
            onComplete={() => loadData()}
            initialRole={preferredInitialRole}
            onOpenIntro={() => setShowIntroGuide(true)}
          />
        )}
      </GestureContainer>
    );
  }

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeTechnicians = Array.isArray(technicians) ? technicians : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  const activeJobs = safeJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const activeJob = safeJobs.find((j) => j.id === selectedJobId) || activeJobs[0] || safeJobs[0];
  const activeRequest = safeRequests.find((r) => r.id === selectedRequestId) || safeRequests[0];
  const activeJobTech = activeJob ? safeTechnicians.find((t) => t.userId === activeJob.technicianId) : null;

  return (
    <GestureContainer onBack={handleBack} onRefresh={loadData} canGoBack={canGoBack}>
      <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
        {/* Top Main App Header */}
        <Header
          onOpenNotifications={() => setIsNotifsOpen(true)}
          unreadNotifsCount={safeNotifications.filter((n) => !n.read).length}
          onOpenIntro={() => setShowIntroGuide(true)}
          onReplayIntro={() => setIsLoadingIntro(true)}
        />

      {/* Guided Workflow Progress Ribbon */}
      <WorkflowProgressRibbon
        currentTab={currentTab}
        onNavigateTab={(tab) => {
          if (tab === 'home' && role === 'customer') {
            setShowWizard(true);
          } else {
            setShowWizard(false);
          }
          if (tab === 'warranties') {
            setCurrentTab('passport');
          } else if (tab === 'parts') {
            setCurrentTab('catalog');
          } else if (tab === 'tracking') {
            setCurrentTab('repairs');
          } else {
            setCurrentTab(tab);
          }
        }}
        onRestartOnboarding={() => {
          logout();
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        {/* ===================== CUSTOMER EXPERIENCE ===================== */}
        {role === 'customer' && (
          <>
            {/* Show 4-step Repair Request Wizard */}
            {showWizard ? (
              <RepairRequestWizard
                onCancel={() => {
                  setShowWizard(false);
                  setWizardPrefill(null);
                }}
                onRequestCreated={(reqId) => {
                  setShowWizard(false);
                  setWizardPrefill(null);
                  setSelectedRequestId(reqId);
                  setCurrentTab('discovery');
                  loadData();
                }}
                preselectedDevice={wizardPrefill?.device}
                preselectedBrand={wizardPrefill?.brand}
                preselectedModel={wizardPrefill?.model}
                preselectedIssue={wizardPrefill?.issue}
              />
            ) : currentTab === 'discovery' && selectedRequestId ? (
              <TechnicianDiscoveryView
                requestId={selectedRequestId}
                onBack={() => setCurrentTab('repairs')}
                onProceedToQuotes={(reqId) => {
                  setSelectedRequestId(reqId);
                  setCurrentTab('quotes');
                }}
              />
            ) : currentTab === 'quotes' && activeRequest ? (
              <QuoteComparisonView
                request={activeRequest}
                onSelectQuoteToPay={(quote, job) => {
                  setPaymentTarget({ quote, job });
                  setSelectedJobId(job.id);
                }}
                onBack={() => setCurrentTab('home')}
              />
            ) : currentTab === 'repairs' ? (
              <CustomerRepairsView
                jobs={jobs}
                requests={requests}
                technicians={technicians}
                selectedJobId={selectedJobId}
                onSelectJob={(jobId) => setSelectedJobId(jobId)}
                onOpenDiscovery={(requestId) => {
                  setSelectedRequestId(requestId);
                  setCurrentTab('discovery');
                }}
                onStartNewRepair={() => {
                  setWizardPrefill(null);
                  setShowWizard(true);
                }}
                onOpenChat={() => setIsChatOpen(true)}
                onOpenReviewModal={() => setShowReviewModal(true)}
                onRefresh={loadData}
              />
            ) : currentTab === 'passport' ? (
              <WarrantyPassportView />
            ) : currentTab === 'messages' ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-base text-slate-900">Active Repair Messages</h3>
                {activeJob ? (
                  <div
                    onClick={() => setIsChatOpen(true)}
                    className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center">
                        {activeJobTech?.businessName?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {activeJobTech?.businessName || 'Emeka Phone Labs'}
                        </h4>
                        <p className="text-xs text-slate-500">Repair #{activeJob.id} • Tap to open chat</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-600">Open Chat →</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No active repair chats.</p>
                )}
              </div>
            ) : currentTab === 'profile' ? (
              <CustomerProfileView
                onViewWarranties={() => setCurrentTab('passport')}
                onOpenDevicesManager={() => setShowDevicesManager(true)}
              />
            ) : (
              <CustomerHomeView
                onStartRepair={(options) => {
                  setWizardPrefill(options || null);
                  setShowWizard(true);
                }}
                onOpenRepair={(jobId) => {
                  setSelectedJobId(jobId);
                  setCurrentTab('repairs');
                }}
                onOpenQuotes={(requestId) => {
                  setSelectedRequestId(requestId);
                  setCurrentTab('quotes');
                }}
                onViewWarranties={() => setCurrentTab('passport')}
                onOpenDevicesManager={() => setShowDevicesManager(true)}
              />
            )}

            {/* Customer Saved Devices Modal */}
            {showDevicesManager && (
              <SavedDevicesManager
                onClose={() => setShowDevicesManager(false)}
                onSelectDeviceForRepair={(dev) => {
                  setShowDevicesManager(false);
                  setWizardPrefill({ device: dev });
                  setShowWizard(true);
                }}
              />
            )}
          </>
        )}

        {/* ===================== TECHNICIAN EXPERIENCE ===================== */}
        {role === 'technician' && (
          <>
            {currentTab === 'store_setup' ? (
              <TechnicianStoreSetupView
                onSetupCompleted={() => {
                  setCurrentTab('dashboard');
                  loadData();
                }}
              />
            ) : currentTab === 'dashboard' ? (
              <TechnicianDashboardView
                onOpenJob={(jobId) => {
                  setSelectedJobId(jobId);
                  setCurrentTab('repairs');
                }}
                onRefresh={loadData}
              />
            ) : currentTab === 'repairs' ? (
              activeJob ? (
                <TechnicianJobWorkspace
                  job={activeJob}
                  onBack={() => setCurrentTab('dashboard')}
                  onRefresh={loadData}
                  onOpenChat={() => setIsChatOpen(true)}
                />
              ) : (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center">
                  <p className="text-sm font-bold text-slate-700">No active work order selected.</p>
                  <button
                    onClick={() => setCurrentTab('dashboard')}
                    className="mt-2 text-xs text-blue-600 font-bold underline"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )
            ) : currentTab === 'catalog' ? (
              <PartsCatalogView />
            ) : (
              <TechnicianProfileView />
            )}
          </>
        )}
      </main>

      {/* Role-Aware Bottom Navigation */}
      {!showWizard && (
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setShowWizard(false);
            setCurrentTab(tab);
          }}
          activeRepairsCount={activeJobs.length}
        />
      )}

      {/* Escrow Payment Modal */}
      {paymentTarget && (
        <EscrowPaymentModal
          job={paymentTarget.job}
          quote={paymentTarget.quote}
          onClose={() => setPaymentTarget(null)}
          onPaymentSuccess={() => {
            setPaymentTarget(null);
            setCurrentTab('repairs');
            loadData();
          }}
        />
      )}

      {/* Verified Review Modal */}
      {showReviewModal && activeJob && (
        <VerifiedReviewModal
          repairId={activeJob.id}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false);
            loadData();
          }}
        />
      )}

      {/* In-App Repair Chat Drawer */}
      <RepairChatDrawer
        repairId={activeJob?.id || 'job_demo_active'}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        otherPartyName={
          role === 'customer'
            ? activeJobTech?.businessName || 'Emeka Phone Labs'
            : 'Tunde Adebayo (Customer)'
        }
      />

      {/* Notifications Slide-Out Drawer */}
      <NotificationDrawer
        isOpen={isNotifsOpen}
        onClose={() => setIsNotifsOpen(false)}
        notifications={notifications}
        onRefresh={loadData}
        onSelectRepair={(repId) => {
          setSelectedJobId(repId);
          setCurrentTab('repairs');
        }}
      />

      {/* Fresh Start Loading Screen Animation */}
      {isLoadingIntro && (
        <LoadingIntroScreen
          onComplete={() => setIsLoadingIntro(false)}
          minDurationMs={1900}
        />
      )}

      {/* Interactive Guided Intro Screen Modal (Optional) */}
      {showIntroGuide && (
        <IntroScreen
          onComplete={() => {
            setShowIntroGuide(false);
          }}
        />
      )}
      </div>
    </GestureContainer>
  );
}

export function App() {
  return (
    <AuthProvider>
      <GoogleMapsProvider>
        <MainAppContent />
      </GoogleMapsProvider>
    </AuthProvider>
  );
}

export default App;
