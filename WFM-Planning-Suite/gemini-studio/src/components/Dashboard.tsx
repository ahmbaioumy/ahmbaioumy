import React, { useState, useEffect } from 'react';
import { ProfileParams, ChannelParams } from '../types';
import { ShieldCheck, Phone, MessageSquare, Mail, Award, Clock, Users, Zap, Briefcase, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import CustomRangeSlider from './CustomRangeSlider';

interface DashboardProps {
  profileParams: ProfileParams;
  setProfileParams: React.Dispatch<React.SetStateAction<ProfileParams>>;
  onLoadTemplate: (templateName: 'standard' | 'digital_heavy' | 'high_service' | 'minimalist') => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function Dashboard({
  profileParams,
  setProfileParams,
  onLoadTemplate,
  activeStep,
  setActiveStep,
  certifiedSteps,
  setCertifiedSteps
}: DashboardProps) {
  useEffect(() => {
    // Auto-certify step 0 (Profile Setup) on load so flow proceeds automatically
    setCertifiedSteps(prev => ({ ...prev, 0: true }));
  }, [setCertifiedSteps]);

  const [selectedChannel, setSelectedChannel] = useState<string>('voice');

  const updateChannelParam = (chan: string, field: keyof ChannelParams, value: number) => {
    setProfileParams(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [chan]: {
          ...prev.channels[chan],
          [field]: value
        }
      }
    }));
  };

  const updateProfileParam = (field: keyof Omit<ProfileParams, 'channels'>, value: any) => {
    setProfileParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleDay = (day: number) => {
    const current = [...profileParams.businessDays];
    if (current.includes(day)) {
      if (current.length > 1) {
        updateProfileParam('businessDays', current.filter(d => d !== day));
      }
    } else {
      updateProfileParam('businessDays', [...current, day].sort());
    }
  };

  const channelsList = [
    { key: 'voice', label: 'Voice Inbound', icon: Phone, color: 'text-blue-500 bg-blue-50' },
    { key: 'chat', label: 'Live Chat', icon: MessageSquare, color: 'text-indigo-500 bg-indigo-50' },
    { key: 'email', label: 'Email Support', icon: Mail, color: 'text-amber-500 bg-amber-50' },
    { key: 'social_media', label: 'Social & Messaging', icon: Zap, color: 'text-pink-500 bg-pink-50' },
    { key: 'complaint', label: 'Complaints Escalation', icon: Award, color: 'text-rose-500 bg-rose-50' },
    { key: 'outbound', label: 'Outbound Campaigns', icon: Phone, color: 'text-emerald-500 bg-emerald-50' },
  ];

  const currentChannelParams = profileParams.channels[selectedChannel];
  const isCertified = certifiedSteps[0];

  return (
    <div className="space-y-8 animate-fadeIn" id="dashboard-tab">
      {/* Certification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">Step 1: Channel Settings Verified</h4>
            <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
              The operational parameters (SLA thresholds, business days, and shrinkage rates) are verified and active. You can now safely proceed to upload or generate data.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveStep(1)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0"
        >
          <span>Continue to Data Ingestion</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Welcome & Overview Header */}
      <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Contact Center Workforce Planning Studio</h2>
        <p className="text-gray-500 max-w-3xl text-sm leading-relaxed">
          Welcome to the Workforce Planning Engine. As a planner, you can simulate and schedule shifts perfectly across multiple transaction channels.
          Configure targets below, load standard templates, and complete the end-to-end operational pipeline step-by-step.
        </p>
        
        {/* Template Loading Quick-Action */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Load Planner Preset Template</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              id="template-standard"
              onClick={() => onLoadTemplate('standard')}
              className="px-4 py-3 border border-gray-200 hover:border-blue-500 rounded-xl text-left hover:bg-blue-50/20 transition group text-xs cursor-pointer"
            >
              <div className="font-semibold text-gray-800 group-hover:text-blue-600">Standard Voice-Heavy</div>
              <div className="text-gray-400 mt-1">SLA 80/20, voice baseline, moderate digital</div>
            </button>
            <button
              id="template-digital"
              onClick={() => onLoadTemplate('digital_heavy')}
              className="px-4 py-3 border border-gray-200 hover:border-indigo-500 rounded-xl text-left hover:bg-indigo-50/20 transition group text-xs cursor-pointer"
            >
              <div className="font-semibold text-gray-800 group-hover:text-indigo-600">Digital Concurrency</div>
              <div className="text-gray-400 mt-1">High Chat & Social, multi-session agents</div>
            </button>
            <button
              id="template-premium"
              onClick={() => onLoadTemplate('high_service')}
              className="px-4 py-3 border border-gray-200 hover:border-emerald-500 rounded-xl text-left hover:bg-emerald-50/20 transition group text-xs cursor-pointer"
            >
              <div className="font-semibold text-gray-800 group-hover:text-emerald-600">Elite SLA Target</div>
              <div className="text-gray-400 mt-1">SLA 90/10, high-occupancy ceiling</div>
            </button>
            <button
              id="template-minimal"
              onClick={() => onLoadTemplate('minimalist')}
              className="px-4 py-3 border border-gray-200 hover:border-amber-500 rounded-xl text-left hover:bg-amber-50/20 transition group text-xs cursor-pointer"
            >
              <div className="font-semibold text-gray-800 group-hover:text-amber-600">Minimal Backlogs</div>
              <div className="text-gray-400 mt-1">Workload email, lower SLA thresholds</div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Business & Agent Schedule profile constraints */}
        <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 pb-4 border-b border-gray-100">
            <Users className="text-gray-500 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Business Window & Labor Hours</h3>
          </div>

          {/* Business Hours Window */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operational Daily Windows</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">Open Time</label>
                <input
                  type="time"
                  value={profileParams.businessWindowStart}
                  onChange={(e) => updateProfileParam('businessWindowStart', e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">Close Time</label>
                <input
                  type="time"
                  value={profileParams.businessWindowEnd}
                  onChange={(e) => updateProfileParam('businessWindowEnd', e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Weekly Workdays selection */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Days of Week</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 1, label: 'M' },
                { val: 2, label: 'T' },
                { val: 3, label: 'W' },
                { val: 4, label: 'T' },
                { val: 5, label: 'F' },
                { val: 6, label: 'S' },
                { val: 0, label: 'S' }
              ].map((day) => {
                const active = profileParams.businessDays.includes(day.val);
                return (
                  <button
                    key={day.val}
                    onClick={() => toggleDay(day.val)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contractual Productive Limits */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Productive Hours Targets</h4>
            <p className="text-[11px] text-gray-400">Target net hours on-line exclusive of lunches, long meetings, etc.</p>
            <div className="space-y-3">
              <CustomRangeSlider
                label="Daily Productive Limit"
                min={4}
                max={12}
                step={0.5}
                value={profileParams.agentProductiveDailyHrs}
                onChange={(val) => updateProfileParam('agentProductiveDailyHrs', val)}
                unit=" hrs"
              />
              <CustomRangeSlider
                label="Weekly Contract Limit"
                min={20}
                max={48}
                step={1}
                value={profileParams.agentProductiveWeeklyHrs}
                onChange={(val) => updateProfileParam('agentProductiveWeeklyHrs', val)}
                unit=" hrs"
              />
              <CustomRangeSlider
                label="Monthly Work Limit"
                min={80}
                max={190}
                step={5}
                value={profileParams.agentProductiveMonthlyHrs}
                onChange={(val) => updateProfileParam('agentProductiveMonthlyHrs', val)}
                unit=" hrs"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Channel Specific Performance Parameter Grids */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-100">
              <ShieldCheck className="text-gray-500 w-5 h-5" />
              <h3 className="font-semibold text-gray-800 text-sm">Channel SLA & Staffing Parameters</h3>
            </div>

            {/* Select Channel tabs */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {channelsList.map((chan) => {
                const Icon = chan.icon;
                const isSelected = selectedChannel === chan.key;
                return (
                  <button
                    key={chan.key}
                    onClick={() => setSelectedChannel(chan.key)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border whitespace-nowrap cursor-pointer transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 text-blue-700 font-semibold'
                        : 'border-gray-100 bg-gray-50/50 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{chan.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Parameter configuration sliders for the selected channel */}
            {currentChannelParams && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-2">
                <CustomRangeSlider
                  label="Target Service Level % (SLA)"
                  min={50}
                  max={99}
                  step={1}
                  value={currentChannelParams.targetSlaPercent}
                  onChange={(val) => updateChannelParam(selectedChannel, 'targetSlaPercent', val)}
                  unit="%"
                  desc="Percent of interactions answered within the target threshold."
                  accentClass="accent-blue-600"
                />

                <CustomRangeSlider
                  label="SLA Time Threshold"
                  min={5}
                  max={300}
                  step={5}
                  value={currentChannelParams.targetSlaSeconds}
                  onChange={(val) => updateChannelParam(selectedChannel, 'targetSlaSeconds', val)}
                  unit="s"
                  desc="Response time target (e.g. 20s for Voice, 45s for Live Chat)."
                  accentClass="accent-blue-600"
                />

                <CustomRangeSlider
                  label="Average Speed of Answer (ASA) Target"
                  min={10}
                  max={600}
                  step={10}
                  value={currentChannelParams.targetAsaSeconds}
                  onChange={(val) => updateChannelParam(selectedChannel, 'targetAsaSeconds', val)}
                  unit="s"
                  desc="Target average wait time for customers in queue."
                  accentClass="accent-indigo-600"
                />

                <CustomRangeSlider
                  label="Answer Percentage (Min Target)"
                  min={70}
                  max={99}
                  step={1}
                  value={currentChannelParams.targetAnswerPercent}
                  onChange={(val) => updateChannelParam(selectedChannel, 'targetAnswerPercent', val)}
                  unit="%"
                  desc="100% minus the maximum acceptable abandonment or busy rate."
                  accentClass="accent-emerald-600"
                />

                <div className="border-t border-gray-100 pt-4 md:col-span-2">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Sizing Safety Buffer Targets</h4>
                </div>

                <CustomRangeSlider
                  label="Maximum Agent Occupancy"
                  min={50}
                  max={95}
                  step={1}
                  value={currentChannelParams.occupancyTarget}
                  onChange={(val) => updateChannelParam(selectedChannel, 'occupancyTarget', val)}
                  unit="%"
                  desc="Limits burnout. Maximum % of logged-on time spent talking/handling."
                  accentClass="accent-amber-600"
                />

                <CustomRangeSlider
                  label="Total Channel Shrinkage"
                  min={5}
                  max={60}
                  step={1}
                  value={currentChannelParams.shrinkage}
                  onChange={(val) => updateChannelParam(selectedChannel, 'shrinkage', val)}
                  unit="%"
                  desc="Total off-line time (sick, coaching, breaks, vacations)."
                  accentClass="accent-rose-600"
                />

                <CustomRangeSlider
                  label="Schedule Adherence Target"
                  min={70}
                  max={99}
                  step={1}
                  value={currentChannelParams.adherence}
                  onChange={(val) => updateChannelParam(selectedChannel, 'adherence', val)}
                  unit="%"
                  desc="Estimated percent of agents working precisely when rostered."
                  accentClass="accent-teal-600"
                />

                <CustomRangeSlider
                  label="Default AHT Reference"
                  min={30}
                  max={1200}
                  step={10}
                  value={currentChannelParams.ahtTarget}
                  onChange={(val) => updateChannelParam(selectedChannel, 'ahtTarget', val)}
                  unit="s"
                  desc="Fallback handling time if not uploaded."
                  accentClass="accent-gray-600"
                />
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
            {isCertified ? (
              <button
                id="continue-to-historical"
                onClick={() => setActiveStep(1)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
              >
                <span>Continue to Data Upload</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
                <AlertTriangle className="w-4 h-4" />
                <span>Please Certify Settings above to unlock Data Upload</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
