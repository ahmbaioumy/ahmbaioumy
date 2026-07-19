import React, { useState, useEffect } from 'react';
import { SizingResultRow, ScheduleAssignment, ShiftTemplate, IntervalScheduleCoverage, ProfileParams, ChannelParams } from '../types';
import { simulateStaffingSchedule } from '../utils/mathUtils';
import { CalendarRange, Plus, Trash2, HelpCircle, BarChart3, AlertTriangle, CheckCircle2, ChevronRight, Sliders, Play, Info, Check, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import CustomRangeSlider from './CustomRangeSlider';

interface SchedulingProps {
  sizingResults: SizingResultRow[];
  scheduleAssignments: ScheduleAssignment[];
  setScheduleAssignments: React.Dispatch<React.SetStateAction<ScheduleAssignment[]>>;
  onNext: () => void;
  channels: string[];
  profileParams: ProfileParams;
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function Scheduling({
  sizingResults,
  scheduleAssignments,
  setScheduleAssignments,
  onNext,
  channels,
  profileParams,
  certifiedSteps,
  setCertifiedSteps
}: SchedulingProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('voice');
  const [capacityLevel, setCapacityLevel] = useState<number>(100); // Scenario capacity percentage (e.g. 95% is -5% capacity failure)
  
  // Roster templates state
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([
    { id: 'st-ft1', name: 'Standard Day (FT)', startTime: '08:00', endTime: '16:30', productiveHrs: 8, daysOfWeek: [1,2,3,4,5], type: 'FT' },
    { id: 'st-ft2', name: 'Mid Shift (FT)', startTime: '12:00', endTime: '20:30', productiveHrs: 8, daysOfWeek: [1,2,3,4,5], type: 'FT' },
    { id: 'st-pt1', name: 'Morning Peak (PT)', startTime: '08:00', endTime: '12:00', productiveHrs: 4, daysOfWeek: [1,2,3,4,5], type: 'PT' },
    { id: 'st-pt2', name: 'Afternoon Peak (PT)', startTime: '13:00', endTime: '17:00', productiveHrs: 4, daysOfWeek: [1,2,3,4,5], type: 'PT' },
    { id: 'st-we', name: 'Weekend Shift', startTime: '09:00', endTime: '17:30', productiveHrs: 8, daysOfWeek: [6,0], type: 'FT' }
  ]);

  // Form states to add custom shifts
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftHrs, setNewShiftHrs] = useState(8);
  const [newShiftType, setNewShiftType] = useState<'FT' | 'PT'>('FT');

  const addCustomShift = () => {
    if (!newShiftName) return;
    const endHour = (parseInt(newShiftStart.split(':')[0]) + newShiftHrs) % 24;
    const endStr = `${endHour < 10 ? '0' : ''}${endHour}:00`;
    
    const newShift: ShiftTemplate = {
      id: `st-custom-${Date.now()}`,
      name: newShiftName,
      startTime: newShiftStart,
      endTime: endStr,
      productiveHrs: newShiftHrs,
      daysOfWeek: [1,2,3,4,5],
      type: newShiftType
    };

    setShiftTemplates(prev => [...prev, newShift]);
    setNewShiftName('');
  };

  const removeShift = (id: string) => {
    setShiftTemplates(prev => prev.filter(s => s.id !== id));
  };

  // Day conversion helper
  const getDayOfWeek1to7 = (dateStr: string): number => {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0 is Sun, 1 is Mon, 6 is Sat
    return jsDay === 0 ? 7 : jsDay;
  };

  const getDayName = (dayNum: number): string => {
    const names = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };
    return names[dayNum as keyof typeof names] || `Day ${dayNum}`;
  };

  const bDays = profileParams.businessDays && profileParams.businessDays.length > 0 
    ? profileParams.businessDays 
    : [1, 2, 3, 4, 5];

  const [selectedDay, setSelectedDay] = useState<number>(bDays[0] || 1);

  // Greedy Week-wide Shift Rostering Engine
  // Resolves the optimal shift allocation to cover the staffing requirement curve for EACH active business day
  const runAutoScheduling = () => {
    const assignments: ScheduleAssignment[] = [];
    
    channels.forEach(chan => {
      const chanSizing = sizingResults.filter(r => r.channel === chan);
      if (chanSizing.length === 0) return;

      bDays.forEach(bDay => {
        // Find sizing rows belonging to this specific weekday
        const daySizing = chanSizing.filter(r => getDayOfWeek1to7(r.date) === bDay);
        // Fallback to average channel curves if no specific weekday is found in input rows
        const activeRows = daySizing.length > 0 ? daySizing : chanSizing;

        // Group requirements by interval
        const intervals = Array.from(new Set(activeRows.map(s => s.interval))).sort();
        const avgIntervalReqs = intervals.map(inter => {
          const matches = activeRows.filter(s => s.interval === inter);
          const avg = matches.reduce((sum, s) => sum + s.finalRequiredAgents, 0) / (matches.length || 1);
          return { interval: inter, required: Math.ceil(avg) };
        });

        // Filter templates active for this specific weekday
        const templates = shiftTemplates.filter(temp => temp.daysOfWeek.includes(bDay));
        const activeTemplates = templates.length > 0 ? templates : shiftTemplates;
        
        const currentCoverage = Array(intervals.length).fill(0);
        const targetReqs = avgIntervalReqs.map(r => r.required);

        let iteration = 0;
        let hasDeficits = true;

        while (hasDeficits && iteration < 45) {
          iteration++;
          hasDeficits = false;

          // Find index of highest deficit
          let maxDeficitIdx = -1;
          let maxDeficitVal = 0;
          for (let i = 0; i < targetReqs.length; i++) {
            const deficit = targetReqs[i] - currentCoverage[i];
            if (deficit > maxDeficitVal) {
              maxDeficitVal = deficit;
              maxDeficitIdx = i;
            }
          }

          if (maxDeficitIdx === -1 || maxDeficitVal <= 0) break;
          hasDeficits = true;

          // Find the best template that covers this peak interval index
          const peakTimeStr = intervals[maxDeficitIdx];
          const peakHour = parseInt(peakTimeStr.split(':')[0]);
          const peakMin = parseInt(peakTimeStr.split(':')[1]);
          const peakDecVal = peakHour + peakMin / 60;

          // Match template covering this decimal hour
          const bestTemplate = activeTemplates.find(temp => {
            const startDec = parseInt(temp.startTime.split(':')[0]) + parseInt(temp.startTime.split(':')[1])/60;
            const endDec = startDec + temp.productiveHrs;
            return peakDecVal >= startDec && peakDecVal < endDec;
          });

          if (bestTemplate) {
            // Add 1 agent to this assignment
            const existingAssignIdx = assignments.findIndex(a => 
              a.shiftId === bestTemplate.id && 
              a.channel === chan && 
              a.dayOfWeek === bDay
            );

            if (existingAssignIdx !== -1) {
              assignments[existingAssignIdx].agentCount++;
            } else {
              assignments.push({
                id: `assign-${chan}-${bestTemplate.id}-${bDay}`,
                shiftId: bestTemplate.id,
                shiftName: bestTemplate.name,
                channel: chan,
                agentCount: 1,
                dayOfWeek: bDay,
                startTime: bestTemplate.startTime,
                endTime: bestTemplate.endTime
              });
            }

            // Apply coverage update
            const tStart = parseInt(bestTemplate.startTime.split(':')[0]) + parseInt(bestTemplate.startTime.split(':')[1])/60;
            const tEnd = tStart + bestTemplate.productiveHrs;

            intervals.forEach((inter, idx) => {
              const iHour = parseInt(inter.split(':')[0]) + parseInt(inter.split(':')[1])/60;
              if (iHour >= tStart && iHour < tEnd) {
                currentCoverage[idx]++;
              }
            });
          } else {
            // Skip to avoid infinite loops if no template covers this block
            targetReqs[maxDeficitIdx] = 0;
          }
        }
      });
    });

    setScheduleAssignments(assignments);
  };

  // Run auto-scheduling on mount, template changes, or sizing data load
  useEffect(() => {
    if (sizingResults.length > 0) {
      runAutoScheduling();
    }
  }, [shiftTemplates, sizingResults]);

  // Auto-certify Step 6 (Scheduling) when schedule assignments exist
  useEffect(() => {
    if (scheduleAssignments && scheduleAssignments.length > 0) {
      setCertifiedSteps(prev => ({ ...prev, 5: true }));
    } else {
      setCertifiedSteps(prev => ({ ...prev, 5: false }));
    }
  }, [scheduleAssignments, setCertifiedSteps]);

  // Generate the full roster data structure
  const getFullRosterData = () => {
    const roster: Array<{
      agentName: string;
      channel: string;
      schedules: Record<number, { shiftName: string; startTime: string; endTime: string }>;
    }> = [];

    channels.forEach(chan => {
      // Find max agents rostered on any day for this channel
      let maxAgents = 0;
      bDays.forEach(bDay => {
        const dailyCount = scheduleAssignments
          .filter(a => a.channel === chan && a.dayOfWeek === bDay)
          .reduce((sum, a) => sum + a.agentCount, 0);
        maxAgents = Math.max(maxAgents, dailyCount);
      });

      if (maxAgents === 0) return;

      // Create agents
      for (let i = 0; i < maxAgents; i++) {
        const agentName = `Agent ${chan.charAt(0).toUpperCase() + chan.slice(1)}-${String(i + 1).padStart(2, '0')}`;
        const schedules: Record<number, { shiftName: string; startTime: string; endTime: string }> = {};

        // Assign shifts for each day of the week (1-7)
        for (let bDay = 1; bDay <= 7; bDay++) {
          const dayAssigns = scheduleAssignments.filter(a => a.channel === chan && a.dayOfWeek === bDay);
          
          // Flatten assignments to a list of shifts
          const flatShifts: Array<{ shiftName: string; startTime: string; endTime: string }> = [];
          dayAssigns.forEach(a => {
            for (let c = 0; c < a.agentCount; c++) {
              flatShifts.push({
                shiftName: a.shiftName,
                startTime: a.startTime,
                endTime: a.endTime
              });
            }
          });

          if (i < flatShifts.length) {
            schedules[bDay] = flatShifts[i];
          } else {
            schedules[bDay] = { shiftName: 'OFF', startTime: '', endTime: '' };
          }
        }

        roster.push({
          agentName,
          channel: chan,
          schedules
        });
      }
    });

    return roster;
  };

  const handleExportRosterCsv = () => {
    const roster = getFullRosterData();
    const uniqueDates = Array.from(new Set(sizingResults.map(r => r.date))).sort();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Day of Week,Channel,Agent Name,Shift Name,Start Time,End Time\n";

    if (uniqueDates.length > 0) {
      // Export for the entire forecasting period
      uniqueDates.forEach(dateStr => {
        const wDay = getDayOfWeek1to7(dateStr);
        const dayName = getDayName(wDay);
        
        // Find agents for this channel
        roster.forEach(agent => {
          const sched = agent.schedules[wDay];
          const shiftName = sched ? sched.shiftName : 'OFF';
          const start = sched ? sched.startTime : '';
          const end = sched ? sched.endTime : '';
          
          csvContent += `"${dateStr}","${dayName}","${agent.channel}","${agent.agentName}","${shiftName}","${start}","${end}"\n`;
        });
      });
    } else {
      // Fallback to a single generic week if no sizingResults loaded yet
      for (let bDay = 1; bDay <= 7; bDay++) {
        const dayName = getDayName(bDay);
        roster.forEach(agent => {
          const sched = agent.schedules[bDay];
          const shiftName = sched ? sched.shiftName : 'OFF';
          const start = sched ? sched.startTime : '';
          const end = sched ? sched.endTime : '';
          
          csvContent += `"Week-wide","${dayName}","${agent.channel}","${agent.agentName}","${shiftName}","${start}","${end}"\n`;
        });
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workforce-agent-weekly-roster-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sizing curve vs roster curves calculations for selected channel & selected day
  const rawChanSizing = sizingResults.filter(r => r.channel === selectedChannel);
  const currentChanSizing = rawChanSizing.filter(r => getDayOfWeek1to7(r.date) === selectedDay).length > 0
    ? rawChanSizing.filter(r => getDayOfWeek1to7(r.date) === selectedDay)
    : rawChanSizing;

  const currentChanAssign = scheduleAssignments.filter(a => 
    a.channel === selectedChannel && 
    a.dayOfWeek === selectedDay
  );

  const intervals = Array.from(new Set(currentChanSizing.map(s => s.interval))).sort();

  const getAgentCoverageAtInterval = (timeStr: string): number => {
    let totalAgents = 0;
    const timeDec = parseInt(timeStr.split(':')[0]) + parseInt(timeStr.split(':')[1])/60;

    currentChanAssign.forEach(assign => {
      const startDec = parseInt(assign.startTime.split(':')[0]) + parseInt(assign.startTime.split(':')[1])/60;
      const endDec = startDec + (assign.endTime ? (parseInt(assign.endTime.split(':')[0]) + parseInt(assign.endTime.split(':')[1])/60 - startDec) : 8);
      
      const isCovered = endDec > startDec 
        ? (timeDec >= startDec && timeDec < endDec)
        : (timeDec >= startDec || timeDec < endDec);

      if (isCovered) {
        totalAgents += assign.agentCount;
      }
    });

    return totalAgents;
  };

  const coverageData = intervals.map(inter => {
    const matchingSizing = currentChanSizing.filter(s => s.interval === inter);
    const avgReq = matchingSizing.reduce((sum, s) => sum + s.finalRequiredAgents, 0) / (matchingSizing.length || 1);
    const scheduled = getAgentCoverageAtInterval(inter);
    
    const actualScheduled = Math.max(0, Math.round(scheduled * (capacityLevel / 100)));
    const avgVolume = matchingSizing.reduce((sum, s) => sum + s.volume, 0) / (matchingSizing.length || 1);
    const avgAht = matchingSizing.reduce((sum, s) => sum + s.aht, 0) / (matchingSizing.length || 1);

    const chanParams: ChannelParams = profileParams?.channels?.[selectedChannel] || {
      targetSlaSeconds: 20,
      targetSlaPercent: 80,
      targetAsaSeconds: 30,
      targetAnswerPercent: 95,
      occupancyTarget: 85,
      utilizationTarget: 80,
      shrinkage: 30,
      adherence: 90,
      ahtTarget: 280
    };

    const sim = simulateStaffingSchedule(
      avgVolume,
      avgAht,
      actualScheduled,
      chanParams,
      40
    );

    return {
      time: inter,
      required: Math.round(avgReq),
      scheduled,
      actualScheduled,
      variance: Math.round(actualScheduled - avgReq),
      volume: avgVolume,
      sla: sim.simulatedSla,
      asa: sim.simulatedAsa,
      abandonRate: sim.abandonRate,
      occupancy: sim.occupancy
    };
  });

  // Calculate daily weighted averages
  let totalDailyVolume = 0;
  let weightedSlaSum = 0;
  let weightedAsaSum = 0;
  let weightedAbandonSum = 0;

  coverageData.forEach(c => {
    if (c.volume > 0) {
      totalDailyVolume += c.volume;
      weightedSlaSum += c.sla * c.volume;
      weightedAsaSum += c.asa * c.volume;
      weightedAbandonSum += c.abandonRate * c.volume;
    }
  });

  const overallSla = totalDailyVolume > 0 ? (weightedSlaSum / totalDailyVolume) : 100;
  const overallAsa = totalDailyVolume > 0 ? (weightedAsaSum / totalDailyVolume) : 0;
  const overallAbandon = totalDailyVolume > 0 ? (weightedAbandonSum / totalDailyVolume) : 0;
  const overallAnsRate = 100 - overallAbandon;

  const overallUnderstaffedHours = coverageData.filter(c => c.variance < 0).length / 2; // half-hour increments
  const overallOverstaffedHours = coverageData.filter(c => c.variance > 0).length / 2;

  return (
    <div className="space-y-8 animate-fadeIn" id="scheduling-tab">
      {/* Certification Banner */}
      {scheduleAssignments.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 6: Shift Scheduler</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl mt-0.5">
                Set active shift blueprints to allocate agents to schedule intervals and generate a weekly full roster.
              </p>
            </div>
          </div>
          <button
            disabled
            className="px-5 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed shrink-0"
          >
            Awaiting Roster Generation
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Step 6: Shift Roster Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The shift schedule roster has been automatically verified and locked. You can now simulate performance under queuing behaviors.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Queue Simulation</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Shift templates & active assignments logs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
              <CalendarRange className="text-blue-600 w-5 h-5" />
              <h3 className="font-semibold text-gray-800 text-sm">Shift Roster Blueprints</h3>
            </div>

            {/* List current shift templates */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {shiftTemplates.map((shift) => (
                <div key={shift.id} className="p-2.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs hover:bg-gray-50/50">
                  <div>
                    <div className="font-semibold text-gray-800">{shift.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{shift.startTime} - {shift.endTime} ({shift.productiveHrs} productive hrs)</div>
                  </div>
                  <button
                    onClick={() => removeShift(shift.id)}
                    className="p-1 text-gray-400 hover:text-rose-600 rounded-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Custom shift template */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Create Custom Shift</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. Late Evening Shift"
                  value={newShiftName}
                  onChange={(e) => setNewShiftName(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newShiftStart}
                      onChange={(e) => setNewShiftStart(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Duration (Hrs)</label>
                    <input
                      type="number"
                      value={newShiftHrs}
                      onChange={(e) => setNewShiftHrs(parseInt(e.target.value) || 8)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5 outline-none text-center"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => setNewShiftType('FT')}
                    className={`flex-1 text-center py-1 text-[10px] font-semibold border rounded-lg cursor-pointer ${
                      newShiftType === 'FT' ? 'border-blue-600 bg-blue-50/20 text-blue-700' : 'border-gray-100'
                    }`}
                  >
                    Full Time
                  </button>
                  <button
                    onClick={() => setNewShiftType('PT')}
                    className={`flex-1 text-center py-1 text-[10px] font-semibold border rounded-lg cursor-pointer ${
                      newShiftType === 'PT' ? 'border-indigo-600 bg-indigo-50/20 text-indigo-700' : 'border-gray-100'
                    }`}
                  >
                    Part Time
                  </button>
                </div>

                <button
                  onClick={addCustomShift}
                  disabled={!newShiftName}
                  className="w-full py-2 bg-gray-50 border border-gray-200 hover:border-blue-400 hover:bg-white text-gray-700 hover:text-blue-600 disabled:opacity-50 disabled:pointer-events-none text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Shift Roster Blueprint</span>
                </button>
              </div>
            </div>
          </div>

          {/* Capacity & KPI Stress Simulation Panel */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
              <Sliders className="text-indigo-600 w-5 h-5" />
              <h3 className="font-semibold text-gray-800 text-sm">Capacity Scenario & Stressor</h3>
            </div>

            <div className="space-y-4">
              <CustomRangeSlider
                label="Rostered Capacity Level"
                min={50}
                max={120}
                step={1}
                value={capacityLevel}
                onChange={(val) => setCapacityLevel(Math.round(val))}
                unit="%"
                accentClass="accent-indigo-600"
              />

              {/* Preset buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCapacityLevel(100)}
                  className={`flex-1 text-center py-1.5 text-[10px] font-semibold border rounded-lg transition cursor-pointer ${
                    capacityLevel === 100 ? 'border-blue-600 bg-blue-50/20 text-blue-700 font-bold' : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  Standard (100%)
                </button>
                <button
                  onClick={() => setCapacityLevel(95)}
                  className={`flex-1 text-center py-1.5 text-[10px] font-semibold border rounded-lg transition cursor-pointer ${
                    capacityLevel === 95 ? 'border-rose-600 bg-rose-50/20 text-rose-700 font-bold' : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  Failure (-5% deficit)
                </button>
              </div>

              {/* Stress Results Box */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
                  <Info className="w-3 h-3 text-gray-400" />
                  <span>Estimated Operational KPIs</span>
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-center">
                    <div className="text-[10px] text-gray-400 font-medium">SLA ({profileParams?.channels?.[selectedChannel]?.targetSlaSeconds}s)</div>
                    <div className={`text-sm font-bold ${overallSla >= (profileParams?.channels?.[selectedChannel]?.targetSlaPercent || 80) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {overallSla.toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-gray-400 mt-0.5">Target: {profileParams?.channels?.[selectedChannel]?.targetSlaPercent}%</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-center">
                    <div className="text-[10px] text-gray-400 font-medium">Answered Rate</div>
                    <div className={`text-sm font-bold ${overallAnsRate >= (profileParams?.channels?.[selectedChannel]?.targetAnswerPercent || 95) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {overallAnsRate.toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-gray-400 mt-0.5">Target: {profileParams?.channels?.[selectedChannel]?.targetAnswerPercent}%</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-center col-span-2">
                    <div className="text-[10px] text-gray-400 font-medium">Average Speed of Answer (ASA)</div>
                    <div className="text-sm font-bold text-gray-800">
                      {overallAsa.toFixed(1)} seconds
                    </div>
                  </div>
                </div>

                {capacityLevel === 95 && (
                  <p className="text-[9px] text-rose-600 font-medium leading-relaxed bg-rose-50/50 p-1.5 rounded-md border border-rose-100">
                    ⚠️ <strong>Capacity Failure Simulation Active:</strong> Notice how dropping workforce availability by just 5% can cascade into severe service-level decay, queue blow-outs, and customer abandoned-rate peaks.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Roster coverage charts & allocations summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="text-gray-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Interval Shift Staffing Coverage vs. Erlang Sizing Requirements</h4>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Selector Channel Tabs */}
                <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-lg">
                  {channels.map((chan) => (
                    <button
                      key={chan}
                      onClick={() => setSelectedChannel(chan)}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer capitalize ${
                        selectedChannel === chan
                          ? 'bg-white text-gray-800 shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {chan}
                    </button>
                  ))}
                </div>

                {/* Weekday Selection Tabs */}
                <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-lg">
                  {bDays.map((day) => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer ${
                        selectedDay === day
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {getDayName(day).substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coverage Chart */}
            {scheduleAssignments.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coverageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#f1f1f1' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {/* Required staffing is drawn as a transparent slate/gray bar */}
                    <Bar dataKey="required" name="Sizing Required" fill="#94a3b8" radius={[2, 2, 0, 0]} opacity={0.5} barSize={10} />
                    {/* Baseline scheduled */}
                    <Bar dataKey="scheduled" name="Baseline Rostered" fill="#60a5fa" radius={[2, 2, 0, 0]} opacity={0.6} barSize={10} />
                    {/* Active scaled scenario staff */}
                    <Bar dataKey="actualScheduled" name="Active Scenario Staff" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400">
                Shift matching coverage curve offline. Check and populate templates.
              </div>
            )}
          </div>

          {/* Schedulers variance analysis */}
          {scheduleAssignments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Variance Stats */}
              <div className="bg-white border border-gray-100 p-4 rounded-xl flex flex-col justify-between">
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Roster Variance Diagnostics</div>
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Understaffed Intervals</span>
                    <span className="font-bold text-rose-500">{overallUnderstaffedHours} hrs/day</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Overstaffed Intervals</span>
                    <span className="font-bold text-amber-500">{overallOverstaffedHours} hrs/day</span>
                  </div>
                </div>
                {overallUnderstaffedHours === 0 ? (
                  <div className="mt-3 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-sm font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Roster is 100% compliant with sizing curve!</span>
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-sm font-semibold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{overallUnderstaffedHours} hrs under coverage thresholds.</span>
                  </div>
                )}
              </div>

              {/* Assignments details list */}
              <div className="bg-white border border-gray-100 p-4 rounded-xl md:col-span-2 space-y-2 max-h-[140px] overflow-y-auto">
                <div className="text-[10px] text-gray-400 font-semibold uppercase border-b border-gray-50 pb-1">Rostered Shift Staff Allocation Summary</div>
                {currentChanAssign.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">No assignments. Run auto scheduler above.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {currentChanAssign.map((assign) => (
                      <div key={assign.id} className="p-1.5 rounded bg-gray-50 flex justify-between items-center">
                        <span className="font-semibold text-gray-700 truncate max-w-[120px]">{assign.shiftName}</span>
                        <strong className="text-blue-600 font-bold">{assign.agentCount} agents</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Weekly Employee-Level Shift Roster & Dispatch Grid */}
          {scheduleAssignments.length > 0 && (
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarRange className="w-4 h-4 text-blue-600" />
                    <span>Weekly Employee-Level Shift Roster</span>
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Individual shift assignments dispatched sequentially to meet forecast requirements.</p>
                </div>
                <button
                  onClick={handleExportRosterCsv}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition cursor-pointer self-start sm:self-center shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Full Roster CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="p-3">Agent ID</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3 text-center">Mon</th>
                      <th className="p-3 text-center">Tue</th>
                      <th className="p-3 text-center">Wed</th>
                      <th className="p-3 text-center">Thu</th>
                      <th className="p-3 text-center">Fri</th>
                      <th className="p-3 text-center">Sat</th>
                      <th className="p-3 text-center">Sun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {getFullRosterData().map((agent) => (
                      <tr key={agent.agentName} className="hover:bg-gray-50/50 transition">
                        <td className="p-3 font-semibold text-gray-700">{agent.agentName}</td>
                        <td className="p-3 text-gray-500 capitalize">
                          <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[9px] font-bold">
                            {agent.channel}
                          </span>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                          const s = agent.schedules[day];
                          const isOff = !s || s.shiftName === 'OFF';
                          return (
                            <td key={day} className="p-3 text-center">
                              {isOff ? (
                                <span className="text-[10px] font-bold text-gray-300">OFF</span>
                              ) : (
                                <div className="inline-block px-2 py-1 rounded bg-blue-50 border border-blue-100 text-[9px] text-blue-700 font-medium">
                                  <div className="font-bold truncate max-w-[80px]" title={s.shiftName}>
                                    {s.shiftName}
                                  </div>
                                  <div className="text-[8px] opacity-75 mt-0.5">
                                    {s.startTime}-{s.endTime}
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        {scheduleAssignments.length > 0 ? (
          <button
            id="continue-to-simulation"
            onClick={onNext}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
          >
            <span>Continue to Queue Simulator</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span>Please generate a roster above to unlock Queue Simulator</span>
          </div>
        )}
      </div>
    </div>
  );
}
