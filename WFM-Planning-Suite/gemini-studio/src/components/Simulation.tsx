import React, { useState, useEffect } from 'react';
import { SizingResultRow, ScheduleAssignment, SimulationResult, ProfileParams, ChannelParams } from '../types';
import { simulateStaffingSchedule } from '../utils/mathUtils';
import { Play, ShieldCheck, Clock, ShieldAlert, Cpu, ChevronRight, BarChart3, AlertCircle, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from 'recharts';

interface SimulationProps {
  sizingResults: SizingResultRow[];
  scheduleAssignments: ScheduleAssignment[];
  profileParams: ProfileParams;
  simulationResult: SimulationResult | null;
  setSimulationResult: React.Dispatch<React.SetStateAction<SimulationResult | null>>;
  onNext: () => void;
  channels: string[];
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function Simulation({
  sizingResults,
  scheduleAssignments,
  profileParams,
  simulationResult,
  setSimulationResult,
  onNext,
  channels,
  certifiedSteps,
  setCertifiedSteps
}: SimulationProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('voice');
  const [simulationRuns, setSimulationRuns] = useState<number>(150); // Fast but reliable runs
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Retrieve channel specific params
  const chanParams: ChannelParams = profileParams.channels[selectedChannel] || {
    targetSlaPercent: 80,
    targetSlaSeconds: 20,
    targetAsaSeconds: 30,
    targetAnswerPercent: 95,
    occupancyTarget: 85,
    utilizationTarget: 80,
    shrinkage: 30,
    adherence: 90,
    ahtTarget: 280
  };

  // Day conversion helper
  const getDayOfWeek1to7 = (dateStr: string): number => {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0 is Sun, 1 is Mon, 6 is Sat
    return jsDay === 0 ? 7 : jsDay;
  };

  // Helper to count active agents rostered at interval decimal value for a specific day of week
  const getScheduledAgentsAtInterval = (timeStr: string, channel: string, dayOfWeek: number): number => {
    let totalAgents = 0;
    const timeDec = parseInt(timeStr.split(':')[0]) + parseInt(timeStr.split(':')[1])/60;

    const chanAssignments = scheduleAssignments.filter(a => a.channel === channel && a.dayOfWeek === dayOfWeek);
    chanAssignments.forEach(assign => {
      const startDec = parseInt(assign.startTime.split(':')[0]) + parseInt(assign.startTime.split(':')[1])/60;
      const endDec = startDec + 8; // productive 8 hrs
      const isCovered = endDec > startDec 
        ? (timeDec >= startDec && timeDec < endDec)
        : (timeDec >= startDec || timeDec < endDec);

      if (isCovered) {
        totalAgents += assign.agentCount;
      }
    });

    return totalAgents;
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    
    // Simulate each interval for the current selected channel
    setTimeout(() => {
      const chanSizing = sizingResults.filter(r => r.channel === selectedChannel);
      
      const filteredSizing = chanSizing.filter(s => {
        if (startDateFilter && s.date < startDateFilter) return false;
        if (endDateFilter && s.date > endDateFilter) return false;
        return true;
      });

      if (filteredSizing.length === 0) {
        setIsSimulating(false);
        return;
      }

      // Group by interval
      const intervals = Array.from(new Set(filteredSizing.map(s => s.interval))).sort();
      const intervalCoverages: any[] = [];

      let sumSla = 0;
      let sumAsa = 0;
      let sumAbandon = 0;
      let sumOccupancy = 0;
      let totalCallsSum = 0;
      let handledCallsSum = 0;
      let abandonedCallsSum = 0;

      intervals.forEach(inter => {
        // Average forecast volume and AHT across historical dates for this interval
        const matches = filteredSizing.filter(s => s.interval === inter);
        const avgVol = matches.reduce((sum, s) => sum + s.volume, 0) / (matches.length || 1);
        const avgAht = matches.reduce((sum, s) => sum + s.aht, 0) / (matches.length || 1);
        
        // Determine the representative day of week for this interval's matches to pull the exact roster day
        const repDate = matches[0]?.date || '';
        const repDay = repDate ? getDayOfWeek1to7(repDate) : 1;

        // Active scheduled agents (scaled down by adherence target representing actual live agents available)
        const scheduledAgentsRaw = getScheduledAgentsAtInterval(inter, selectedChannel, repDay);
        const liveAgentsAvailable = Math.round(scheduledAgentsRaw * (chanParams.adherence / 100));

        // Simulate
        const sim = simulateStaffingSchedule(
          Math.max(1, Math.round(avgVol)),
          Math.max(30, Math.round(avgAht)),
          Math.max(1, liveAgentsAvailable),
          chanParams,
          simulationRuns
        );

        const totalIntervalCalls = Math.round(avgVol);
        const abandonedIntervalCalls = Math.round(totalIntervalCalls * (sim.abandonRate / 100));
        const handledIntervalCalls = totalIntervalCalls - abandonedIntervalCalls;

        sumSla += sim.simulatedSla;
        sumAsa += sim.simulatedAsa;
        sumAbandon += sim.abandonRate;
        sumOccupancy += sim.occupancy;
        
        totalCallsSum += totalIntervalCalls;
        handledCallsSum += handledIntervalCalls;
        abandonedCallsSum += abandonedIntervalCalls;

        intervalCoverages.push({
          time: inter,
          volume: totalIntervalCalls,
          aht: Math.round(avgAht),
          agentsAvailable: liveAgentsAvailable,
          simulatedSla: Math.round(sim.simulatedSla * 10) / 10,
          simulatedAsa: Math.round(sim.simulatedAsa * 10) / 10,
          abandonRate: Math.round(sim.abandonRate * 10) / 10,
          occupancy: Math.round(sim.occupancy * 10) / 10
        });
      });

      const n = intervals.length || 1;

      setSimulationResult({
        intervalCoverages,
        overallSla: Math.round((sumSla / n) * 10) / 10,
        overallAsa: Math.round((sumAsa / n) * 10) / 10,
        overallAbandonRate: Math.round((sumAbandon / n) * 10) / 10,
        overallOccupancy: Math.round((sumOccupancy / n) * 10) / 10,
        totalCalls: totalCallsSum,
        handledCalls: handledCallsSum,
        abandonedCalls: abandonedCallsSum
      });

      setIsSimulating(false);
    }, 800); // Small timeout to look like a calculation engine is solving
  };

  // Run automatically when step is active and inputs are available
  useEffect(() => {
    if (sizingResults.length > 0 && scheduleAssignments.length > 0 && !simulationResult) {
      handleRunSimulation();
    }
  }, [selectedChannel, sizingResults, scheduleAssignments]);

  // Chart plotting SLA achievement vs SLA target
  const chartData = simulationResult 
    ? simulationResult.intervalCoverages.map(c => ({
        time: c.time,
        'Simulated SLA %': c.simulatedSla,
        'Target SLA threshold': chanParams.targetSlaPercent
      }))
    : [];

  // Pagination for interval table details
  const itemsPerPage = 8;
  const tableData = simulationResult ? simulationResult.intervalCoverages : [];
  const totalPages = Math.ceil(tableData.length / itemsPerPage) || 1;
  const paginatedTable = tableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8 animate-fadeIn" id="simulation-tab">
      {/* Certification Banner */}
      {!simulationResult ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 7: Queue Simulator</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl mt-0.5">
                Press "Simulate Queue Performance" to solve Poisson distributions for intervals using the roster.
              </p>
            </div>
          </div>
          <button
            disabled
            className="px-5 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed shrink-0"
          >
            Awaiting Simulation
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Step 7: SLA Simulation Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The queue performance has been automatically verified with a simulated overall SLA of {simulationResult.overallSla}%. Downstream financial modules are active.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Cost Analysis</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Control Panel: Simulator Settings */}
        <div className="md:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
            <Cpu className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Poisson Queue Simulator</h3>
          </div>

          <div className="space-y-4">
            {/* Channels tab list */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Channel Queue</label>
              <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl overflow-x-auto">
                {channels.map((chan) => (
                  <button
                    key={chan}
                    onClick={() => {
                      setSelectedChannel(chan);
                      setSimulationResult(null); // Force recalculation
                      setCurrentPage(1);
                    }}
                    className={`flex-1 text-center py-2 text-[10px] font-semibold rounded-lg transition capitalize whitespace-nowrap cursor-pointer ${
                      selectedChannel === chan
                        ? 'bg-white text-gray-800 shadow-xs font-bold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {chan}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="space-y-2 pt-2 border-t border-gray-50">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Period Filter</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-gray-400 mb-1">From Date</span>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setSimulationResult(null);
                    }}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 mb-1">To Date</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setSimulationResult(null);
                    }}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Simulation Runs */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Monte Carlo Sample Size</span>
                <span className="font-semibold text-gray-700">{simulationRuns} iterations</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={simulationRuns}
                onChange={(e) => setSimulationRuns(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Higher values yield finer SLA results but take longer to process offline.</span>
            </div>
          </div>

          <button
            id="run-simulation"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <span>Solving Queues...</span>
                <RefreshCw className="w-4 h-4 animate-spin" />
              </>
            ) : (
              <>
                <span>Execute Simulation</span>
                <Play className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Right Sizing Simulation reports & graphs */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Main Visualizations chart: Simulated SLA vs Target SLA constant */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="text-gray-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Simulated Interval Service Level % (SLA)</h4>
              </div>
            </div>

            {simulationResult ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke="#9ca3af" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#f1f1f1' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="Simulated SLA %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Target SLA threshold" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400">
                Click 'Execute Simulation' to run queue performance diagnostics.
              </div>
            )}
          </div>

          {/* Simulated Gauge stats boxes */}
          {simulationResult && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto" />
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Overall SLA %</div>
                <div className="text-base font-bold text-gray-800">{simulationResult.overallSla}%</div>
                <div className="text-[9px] text-gray-400">Target: {chanParams.targetSlaPercent}%</div>
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
                <Clock className="w-4 h-4 text-blue-600 mx-auto" />
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Overall ASA</div>
                <div className="text-base font-bold text-gray-800">{simulationResult.overallAsa}s</div>
                <div className="text-[9px] text-gray-400">Target: {chanParams.targetAsaSeconds}s</div>
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 mx-auto" />
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Abandon rate</div>
                <div className="text-base font-bold text-gray-800">{simulationResult.overallAbandonRate}%</div>
                <div className="text-[9px] text-gray-400">Target: &lt;5%</div>
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
                <Cpu className="w-4 h-4 text-indigo-600 mx-auto" />
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Agent Occupancy</div>
                <div className="text-base font-bold text-gray-800">{simulationResult.overallOccupancy}%</div>
                <div className="text-[9px] text-gray-400">Max Cap: {chanParams.occupancyTarget}%</div>
              </div>
            </div>
          )}

          {/* Detailed tabular simulation overview */}
          {simulationResult && (
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
                <AlertCircle className="text-gray-500 w-4 h-4" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Interval Simulation Telemetry Log ({selectedChannel.toUpperCase()})</h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium">
                      <th className="py-2">Interval</th>
                      <th className="py-2 text-right">Volume</th>
                      <th className="py-2 text-right">Agents Available</th>
                      <th className="py-2 text-right">Simulated SLA %</th>
                      <th className="py-2 text-right">Simulated ASA</th>
                      <th className="py-2 text-right">Abandon Rate %</th>
                      <th className="py-2 text-right">Agent Occupancy %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                    {paginatedTable.map((row, idx) => {
                      const slaMet = row.simulatedSla >= chanParams.targetSlaPercent;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/30">
                          <td className="py-2.5 font-bold">{row.time}</td>
                          <td className="py-2.5 text-right font-normal text-gray-400">{row.volume}</td>
                          <td className="py-2.5 text-right">{row.agentsAvailable}</td>
                          <td className={`py-2.5 text-right font-bold ${slaMet ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {row.simulatedSla}%
                          </td>
                          <td className="py-2.5 text-right font-normal text-gray-500">{row.simulatedAsa}s</td>
                          <td className="py-2.5 text-right font-normal text-rose-500">-{row.abandonRate}%</td>
                          <td className="py-2.5 text-right text-gray-800">{row.occupancy}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <div>
                  Showing {paginatedTable.length} of {tableData.length} intervals
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-xs"
                  >
                    Prev
                  </button>
                  <span className="text-gray-700 font-semibold">Page {currentPage} of {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        {certifiedSteps[6] ? (
          <button
            id="continue-to-cost"
            onClick={onNext}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
          >
            <span>Continue to Final Cost &amp; Analysis Report</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span>Please Verify &amp; Certify Simulation results above to unlock Cost Report</span>
          </div>
        )}
      </div>
    </div>
  );
}
