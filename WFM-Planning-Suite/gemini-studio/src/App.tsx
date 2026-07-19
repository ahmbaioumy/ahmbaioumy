import React, { useState, useEffect } from 'react';
import { 
  ProfileParams, 
  HistoricalRow, 
  ForecastRow, 
  SizingResultRow, 
  CapacityMonthlyPlan, 
  ScheduleAssignment, 
  SimulationResult,
  ForecastingModel,
  CleansingMethod
} from './types';
import Dashboard from './components/Dashboard';
import UploadCleansing from './components/UploadCleansing';
import Forecasting from './components/Forecasting';
import SizingErlang from './components/SizingErlang';
import CapacityPlanning from './components/CapacityPlanning';
import Scheduling from './components/Scheduling';
import Simulation from './components/Simulation';
import CostAnalysis from './components/CostAnalysis';

import { 
  Sliders, 
  Database, 
  TrendingUp, 
  Cpu, 
  Briefcase, 
  CalendarRange, 
  Play, 
  DollarSign,
  Lock,
  CheckCircle,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Workflow Global States
  const [profileParams, setProfileParams] = useState<ProfileParams>({
    channels: {
      voice: { targetSlaPercent: 80, targetSlaSeconds: 20, targetAsaSeconds: 30, targetAnswerPercent: 95, occupancyTarget: 85, utilizationTarget: 80, shrinkage: 30, adherence: 90, ahtTarget: 280 },
      chat: { targetSlaPercent: 85, targetSlaSeconds: 45, targetAsaSeconds: 40, targetAnswerPercent: 92, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 25, adherence: 92, ahtTarget: 360 },
      email: { targetSlaPercent: 95, targetSlaSeconds: 1800, targetAsaSeconds: 300, targetAnswerPercent: 99, occupancyTarget: 90, utilizationTarget: 90, shrinkage: 20, adherence: 95, ahtTarget: 600 },
      social_media: { targetSlaPercent: 90, targetSlaSeconds: 60, targetAsaSeconds: 60, targetAnswerPercent: 94, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 25, adherence: 90, ahtTarget: 240 },
      complaint: { targetSlaPercent: 95, targetSlaSeconds: 3600, targetAsaSeconds: 600, targetAnswerPercent: 98, occupancyTarget: 85, utilizationTarget: 85, shrinkage: 30, adherence: 90, ahtTarget: 650 },
      outbound: { targetSlaPercent: 80, targetSlaSeconds: 120, targetAsaSeconds: 120, targetAnswerPercent: 90, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 30, adherence: 90, ahtTarget: 180 }
    },
    agentProductiveDailyHrs: 8,
    agentProductiveWeeklyHrs: 40,
    agentProductiveMonthlyHrs: 160,
    businessWindowStart: "08:00",
    businessWindowEnd: "20:00",
    businessDays: [1, 2, 3, 4, 5] // Mon-Fri
  });

  const [historicalData, setHistoricalData] = useState<HistoricalRow[]>([]);
  const [cleansingMethod, setCleansingMethod] = useState<CleansingMethod>('moving_median');
  const [forecastData, setForecastData] = useState<ForecastRow[]>([]);
  const [forecastingModel, setForecastingModel] = useState<ForecastingModel>('prophet_style');
  const [sizingResults, setSizingResults] = useState<SizingResultRow[]>([]);
  const [capacityPlan, setCapacityPlan] = useState<CapacityMonthlyPlan[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Workflow Certification States for Strict Flow Dependencies
  const [certifiedSteps, setCertifiedSteps] = useState<Record<number, boolean>>({
    0: false, // Profile Setup
    1: false, // Historical & Cleansing
    2: false, // Forecasting
    3: false, // Sizing
    4: false, // Capacity Planning
    5: false, // Scheduling
    6: false, // Simulation
    7: false  // Cost Analysis
  });

  // Channels list derived from profile
  const activeChannels = Object.keys(profileParams.channels);

  // Preset Template Loader
  const handleLoadTemplate = (templateName: 'standard' | 'digital_heavy' | 'high_service' | 'minimalist') => {
    // Clean down stream states on templates load to avoid mismatch locks
    setHistoricalData([]);
    setForecastData([]);
    setSizingResults([]);
    setScheduleAssignments([]);
    setSimulationResult(null);
    setCertifiedSteps({
      0: false,
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false
    });

    if (templateName === 'standard') {
      setProfileParams({
        channels: {
          voice: { targetSlaPercent: 80, targetSlaSeconds: 20, targetAsaSeconds: 30, targetAnswerPercent: 95, occupancyTarget: 85, utilizationTarget: 80, shrinkage: 30, adherence: 90, ahtTarget: 280 },
          chat: { targetSlaPercent: 85, targetSlaSeconds: 45, targetAsaSeconds: 40, targetAnswerPercent: 92, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 25, adherence: 92, ahtTarget: 360 },
          email: { targetSlaPercent: 95, targetSlaSeconds: 3600, targetAsaSeconds: 600, targetAnswerPercent: 99, occupancyTarget: 90, utilizationTarget: 90, shrinkage: 20, adherence: 95, ahtTarget: 500 },
          social_media: { targetSlaPercent: 90, targetSlaSeconds: 60, targetAsaSeconds: 60, targetAnswerPercent: 94, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 25, adherence: 90, ahtTarget: 240 },
          complaint: { targetSlaPercent: 95, targetSlaSeconds: 3600, targetAsaSeconds: 600, targetAnswerPercent: 98, occupancyTarget: 85, utilizationTarget: 85, shrinkage: 30, adherence: 90, ahtTarget: 650 },
          outbound: { targetSlaPercent: 80, targetSlaSeconds: 120, targetAsaSeconds: 120, targetAnswerPercent: 90, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 30, adherence: 90, ahtTarget: 180 }
        },
        agentProductiveDailyHrs: 8,
        agentProductiveWeeklyHrs: 40,
        agentProductiveMonthlyHrs: 160,
        businessWindowStart: "08:00",
        businessWindowEnd: "20:00",
        businessDays: [1, 2, 3, 4, 5]
      });
    } else if (templateName === 'digital_heavy') {
      setProfileParams({
        channels: {
          chat: { targetSlaPercent: 90, targetSlaSeconds: 30, targetAsaSeconds: 25, targetAnswerPercent: 96, occupancyTarget: 82, utilizationTarget: 80, shrinkage: 20, adherence: 94, ahtTarget: 240 },
          social_media: { targetSlaPercent: 92, targetSlaSeconds: 45, targetAsaSeconds: 30, targetAnswerPercent: 95, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 22, adherence: 92, ahtTarget: 180 },
          email: { targetSlaPercent: 95, targetSlaSeconds: 1800, targetAsaSeconds: 180, targetAnswerPercent: 99, occupancyTarget: 88, utilizationTarget: 85, shrinkage: 18, adherence: 95, ahtTarget: 420 },
          voice: { targetSlaPercent: 75, targetSlaSeconds: 30, targetAsaSeconds: 45, targetAnswerPercent: 90, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 30, adherence: 88, ahtTarget: 320 },
          complaint: { targetSlaPercent: 90, targetSlaSeconds: 7200, targetAsaSeconds: 900, targetAnswerPercent: 95, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 25, adherence: 90, ahtTarget: 600 },
          outbound: { targetSlaPercent: 70, targetSlaSeconds: 180, targetAsaSeconds: 180, targetAnswerPercent: 85, occupancyTarget: 70, utilizationTarget: 75, shrinkage: 25, adherence: 88, ahtTarget: 150 }
        },
        agentProductiveDailyHrs: 7.5,
        agentProductiveWeeklyHrs: 37.5,
        agentProductiveMonthlyHrs: 150,
        businessWindowStart: "09:00",
        businessWindowEnd: "18:00",
        businessDays: [1, 2, 3, 4, 5]
      });
    } else if (templateName === 'high_service') {
      setProfileParams({
        channels: {
          voice: { targetSlaPercent: 90, targetSlaSeconds: 15, targetAsaSeconds: 15, targetAnswerPercent: 98, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 35, adherence: 95, ahtTarget: 260 },
          chat: { targetSlaPercent: 90, targetSlaSeconds: 20, targetAsaSeconds: 20, targetAnswerPercent: 97, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 25, adherence: 95, ahtTarget: 300 },
          email: { targetSlaPercent: 98, targetSlaSeconds: 900, targetAsaSeconds: 60, targetAnswerPercent: 99.5, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 20, adherence: 98, ahtTarget: 480 },
          social_media: { targetSlaPercent: 95, targetSlaSeconds: 30, targetAsaSeconds: 20, targetAnswerPercent: 98, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 25, adherence: 94, ahtTarget: 200 },
          complaint: { targetSlaPercent: 98, targetSlaSeconds: 1800, targetAsaSeconds: 300, targetAnswerPercent: 99, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 30, adherence: 95, ahtTarget: 550 },
          outbound: { targetSlaPercent: 85, targetSlaSeconds: 60, targetAsaSeconds: 60, targetAnswerPercent: 95, occupancyTarget: 75, utilizationTarget: 75, shrinkage: 30, adherence: 92, ahtTarget: 160 }
        },
        agentProductiveDailyHrs: 8,
        agentProductiveWeeklyHrs: 40,
        agentProductiveMonthlyHrs: 160,
        businessWindowStart: "08:00",
        businessWindowEnd: "22:00",
        businessDays: [1, 2, 3, 4, 5, 6, 0] // 7-day operations
      });
    } else if (templateName === 'minimalist') {
      setProfileParams({
        channels: {
          email: { targetSlaPercent: 80, targetSlaSeconds: 7200, targetAsaSeconds: 1800, targetAnswerPercent: 90, occupancyTarget: 95, utilizationTarget: 90, shrinkage: 15, adherence: 90, ahtTarget: 400 },
          outbound: { targetSlaPercent: 75, targetSlaSeconds: 300, targetAsaSeconds: 300, targetAnswerPercent: 85, occupancyTarget: 80, utilizationTarget: 80, shrinkage: 20, adherence: 90, ahtTarget: 150 },
          voice: { targetSlaPercent: 70, targetSlaSeconds: 60, targetAsaSeconds: 90, targetAnswerPercent: 88, occupancyTarget: 90, utilizationTarget: 85, shrinkage: 25, adherence: 88, ahtTarget: 300 },
          chat: { targetSlaPercent: 75, targetSlaSeconds: 90, targetAsaSeconds: 90, targetAnswerPercent: 85, occupancyTarget: 85, utilizationTarget: 80, shrinkage: 20, adherence: 88, ahtTarget: 360 },
          social_media: { targetSlaPercent: 80, targetSlaSeconds: 120, targetAsaSeconds: 120, targetAnswerPercent: 88, occupancyTarget: 85, utilizationTarget: 80, shrinkage: 20, adherence: 88, ahtTarget: 240 },
          complaint: { targetSlaPercent: 90, targetSlaSeconds: 14400, targetAsaSeconds: 3600, targetAnswerPercent: 95, occupancyTarget: 90, utilizationTarget: 85, shrinkage: 25, adherence: 90, ahtTarget: 600 }
        },
        agentProductiveDailyHrs: 8.5,
        agentProductiveWeeklyHrs: 42.5,
        agentProductiveMonthlyHrs: 170,
        businessWindowStart: "08:30",
        businessWindowEnd: "17:30",
        businessDays: [1, 2, 3, 4, 5]
      });
    }
  };

  // Step definition details and locks configuration
  const steps = [
    { label: 'Profile Setup', icon: Sliders, lockCondition: false },
    { label: 'Historical & Cleansing', icon: Database, lockCondition: !certifiedSteps[0] },
    { label: 'Forecast Generation', icon: TrendingUp, lockCondition: !certifiedSteps[1] || historicalData.length === 0 },
    { label: 'Erlang Sizing', icon: Cpu, lockCondition: !certifiedSteps[2] || forecastData.length === 0 },
    { label: 'Capacity Hiring', icon: Briefcase, lockCondition: !certifiedSteps[3] || sizingResults.length === 0 },
    { label: 'Shift Scheduling', icon: CalendarRange, lockCondition: !certifiedSteps[3] || sizingResults.length === 0 },
    { label: 'Queue Simulation', icon: Play, lockCondition: !certifiedSteps[4] || !certifiedSteps[5] || scheduleAssignments.length === 0 },
    { label: 'Cost Analysis & Export', icon: DollarSign, lockCondition: !certifiedSteps[6] || capacityPlan.length === 0 }
  ];

  const handleStepClick = (idx: number) => {
    // Enforce step dependency flow
    if (steps[idx].lockCondition) {
      alert(`Access Blocked: Please complete and certify the prerequisite computations before loading the ${steps[idx].label} module.`);
      return;
    }
    setActiveStep(idx);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#fafbfc] overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR NAVIGATION PANEL */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-[#0f172a] text-gray-400 border-r border-[#1e293b] transform ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:relative lg:translate-x-0 transition-transform duration-200 ease-in-out flex-shrink-0`}>
        
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5 px-6 py-5 border-b border-[#1e293b]">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-lg shadow-blue-500/20">W</div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Workforce Studio</h1>
            <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Planner Edition</span>
          </div>
        </div>

        {/* Workflow steps navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            const isLocked = step.lockCondition;
            const isCertified = certifiedSteps[idx];

            return (
              <button
                key={idx}
                disabled={isLocked}
                onClick={() => handleStepClick(idx)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition text-xs font-semibold select-none cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10 font-bold' 
                    : isLocked
                      ? 'text-gray-600 opacity-60 cursor-not-allowed'
                      : 'text-gray-400 hover:bg-[#1e293b]/50 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isLocked ? 'text-gray-700' : 'text-gray-500'}`} />
                  <span className="truncate">{step.label}</span>
                </div>
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-gray-700" />
                ) : isCertified ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                ) : !isLocked && idx < activeStep ? (
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer Credit */}
        <div className="p-4 border-t border-[#1e293b] text-center text-[10px] text-gray-500">
          <div>Planner Engine v1.4.0</div>
          <div className="mt-0.5 font-medium">100% Offline Local Mode</div>
        </div>
      </aside>

      {/* MAIN CONTAINER CONTENT WINDOW */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* TOP MOBILE BAR / TOOLBAR */}
        <header className="flex items-center justify-between lg:justify-end px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-gray-500 hover:text-gray-800 lg:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="flex items-center space-x-4 text-xs font-semibold text-gray-500">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-gray-700 font-medium">Operational Planning State Ready</span>
            </span>
          </div>
        </header>

        {/* COMPONENT BODY ROUTING */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            
            {activeStep === 0 && (
              <Dashboard 
                profileParams={profileParams} 
                setProfileParams={setProfileParams} 
                onLoadTemplate={handleLoadTemplate}
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 1 && (
              <UploadCleansing 
                historicalData={historicalData}
                setHistoricalData={setHistoricalData}
                cleansingMethod={cleansingMethod}
                setCleansingMethod={setCleansingMethod}
                onNext={() => setActiveStep(2)}
                channels={activeChannels}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 2 && (
              <Forecasting 
                historicalData={historicalData}
                forecastData={forecastData}
                setForecastData={setForecastData}
                forecastingModel={forecastingModel}
                setForecastingModel={setForecastingModel}
                onNext={() => setActiveStep(3)}
                channels={activeChannels}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 3 && (
              <SizingErlang 
                forecastData={forecastData}
                sizingResults={sizingResults}
                setSizingResults={setSizingResults}
                profileParams={profileParams}
                onNext={() => setActiveStep(4)}
                channels={activeChannels}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 4 && (
              <CapacityPlanning 
                sizingResults={sizingResults}
                capacityPlan={capacityPlan}
                setCapacityPlan={setCapacityPlan}
                onNext={() => setActiveStep(5)}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 5 && (
              <Scheduling 
                sizingResults={sizingResults}
                scheduleAssignments={scheduleAssignments}
                setScheduleAssignments={setScheduleAssignments}
                onNext={() => setActiveStep(6)}
                channels={activeChannels}
                profileParams={profileParams}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 6 && (
              <Simulation 
                sizingResults={sizingResults}
                scheduleAssignments={scheduleAssignments}
                profileParams={profileParams}
                simulationResult={simulationResult}
                setSimulationResult={setSimulationResult}
                onNext={() => setActiveStep(7)}
                channels={activeChannels}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

            {activeStep === 7 && (
              <CostAnalysis 
                capacityPlan={capacityPlan}
                sizingResults={sizingResults}
                simulationResult={simulationResult}
                channels={activeChannels}
                historicalData={historicalData}
                forecastData={forecastData}
                scheduleAssignments={scheduleAssignments}
                profileParams={profileParams}
                certifiedSteps={certifiedSteps}
                setCertifiedSteps={setCertifiedSteps}
              />
            )}

          </div>
        </div>
      </main>

      {/* MOBILE MENU SHADOW OVERLAY */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        ></div>
      )}
    </div>
  );
}
