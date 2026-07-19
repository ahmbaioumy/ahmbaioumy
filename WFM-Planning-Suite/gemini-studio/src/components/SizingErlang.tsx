import React, { useState } from 'react';
import { ForecastRow, SizingResultRow, SizingModel, ChannelParams, ProfileParams } from '../types';
import { calculateStaffingNeeded } from '../utils/mathUtils';
import { aggregateSizing, AggregationLevel } from '../utils/aggregationUtils';
import { Cpu, ChevronRight, AlertCircle, BarChart3, TrendingUp, Info, Check, Table, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface SizingErlangProps {
  forecastData: ForecastRow[];
  sizingResults: SizingResultRow[];
  setSizingResults: React.Dispatch<React.SetStateAction<SizingResultRow[]>>;
  profileParams: ProfileParams;
  onNext: () => void;
  channels: string[];
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function SizingErlang({
  forecastData,
  sizingResults,
  setSizingResults,
  profileParams,
  onNext,
  channels,
  certifiedSteps,
  setCertifiedSteps
}: SizingErlangProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('voice');
  const [sizingModel, setSizingModel] = useState<SizingModel>('erlang_c');
  const [overrideParams, setOverrideParams] = useState<Record<string, Partial<ChannelParams>>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [aggLevel, setAggLevel] = useState<AggregationLevel>('interval');
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'both'>('both');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Recommendation logic
  const getRecommendation = (chan: string): { model: SizingModel; reason: string } => {
    switch (chan) {
      case 'voice':
        return { model: 'erlang_c', reason: 'High-volume voice calls with an active queue. Erlang C is standard for computing queuing delays.' };
      case 'chat':
        return { model: 'erlang_a', reason: 'Live chat sessions with customer patience thresholds. Erlang A incorporates abandonments/dropouts.' };
      case 'email':
      case 'complaint':
        return { model: 'workload', reason: 'Backlog-based channels (non-realtime). Direct workload volume computations are ideal.' };
      case 'social_media':
        return { model: 'blended', reason: 'Digital messaging with multi-tasking concurrency (agents handling 2-3 sessions at once).' };
      case 'outbound':
        return { model: 'erlang_b', reason: 'Outbound trunks or cold-dialing systems with trunk lines blocking probability.' };
      default:
        return { model: 'erlang_c', reason: 'Standard telephone queues.' };
    }
  };

  const currentRec = getRecommendation(selectedChannel);

  // Retrieve channel params with optional overrides
  const getChannelParamsMerged = (chan: string): ChannelParams => {
    const base = profileParams.channels[chan];
    const override = overrideParams[chan] || {};
    return { ...base, ...override };
  };

  const handleRunSizing = () => {
    const results: SizingResultRow[] = [];
    
    // Group forecast data by channel
    channels.forEach(chan => {
      const chanForecast = forecastData.filter(d => d.channel === chan);
      const chanParams = getChannelParamsMerged(chan);
      const modelToUse = chan === selectedChannel ? sizingModel : getRecommendation(chan).model;

      chanForecast.forEach(row => {
        const staff = calculateStaffingNeeded(modelToUse, row.volume, row.aht, chanParams, 30);
        
        results.push({
          id: `s-${row.id}`,
          timestamp: row.timestamp,
          date: row.date,
          time: row.time,
          interval: row.interval,
          channel: chan,
          volume: row.volume,
          aht: row.aht,
          workloadHrs: Math.round(((row.volume * row.aht) / 3600) * 100) / 100,
          rawRequiredAgents: staff.rawRequired,
          occupancyAdjusted: staff.occupancyAdjusted,
          shrinkageAdjusted: staff.shrinkageAdjusted,
          finalRequiredAgents: staff.finalRequired
        });
      });
    });

    setSizingResults(results);
    setCurrentPage(1);
  };

  const currentMergedParams = getChannelParamsMerged(selectedChannel);
  const updateOverrideParam = (field: keyof ChannelParams, value: number) => {
    setOverrideParams(prev => ({
      ...prev,
      [selectedChannel]: {
        ...(prev[selectedChannel] || {}),
        [field]: value
      }
    }));
  };

  // Process data for charts & tables using aggregateSizing helper
  const filteredSizing = sizingResults.filter(s => {
    if (startDateFilter && s.date < startDateFilter) return false;
    if (endDateFilter && s.date > endDateFilter) return false;
    return true;
  });

  const aggregatedData = aggregateSizing(filteredSizing, aggLevel, selectedChannel);

  // Pagination for table view
  const itemsPerPage = 8;
  const totalPages = Math.ceil(aggregatedData.length / itemsPerPage) || 1;
  const paginatedResults = aggregatedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8 animate-fadeIn" id="sizing-tab">
      {/* Certification Banner */}
      {sizingResults.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 4: Sizing &amp; Erlang Sizing Calculations</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl mt-0.5">
                Adjust Erlang thresholds (SLA targets, occupancy, agent multitasking limits), then trigger calculations to determine agent FTE needs.
              </p>
            </div>
          </div>
          <button
            disabled
            className="px-5 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed shrink-0"
          >
            Awaiting Calculation
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Step 4: Erlang Sizing Requirements Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The Erlang sizing results are automatically validated and locked. The capacity and roster modules are active.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Capacity Planning</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left control Panel: Sizing Settings */}
        <div className="md:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
            <Cpu className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Sizing Model Architecture</h3>
          </div>

          {/* Selector Channel tabs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Focus Channel</label>
            <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl">
              {channels.map((chan) => (
                <button
                  key={chan}
                  onClick={() => {
                    setSelectedChannel(chan);
                    const rec = getRecommendation(chan);
                    setSizingModel(rec.model);
                    setCurrentPage(1);
                  }}
                  className={`flex-1 text-center py-2 text-[10px] font-semibold rounded-lg transition capitalize whitespace-nowrap cursor-pointer ${
                    selectedChannel === chan
                      ? 'bg-white text-gray-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {chan}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendations box */}
          <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl text-xs space-y-1.5">
            <span className="font-bold text-blue-800">Erlang Recommendation:</span>
            <span className="text-blue-700 block text-[11px] font-medium leading-relaxed">
              {currentRec.reason}
            </span>
            <button
              onClick={() => setSizingModel(currentRec.model)}
              className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-blue-800 hover:underline cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Use recommended: {currentRec.model.replace('_', ' ').toUpperCase()}</span>
            </button>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Staffing Model</label>
            <div className="space-y-1.5">
              {[
                { val: 'erlang_c', label: 'Erlang C (Queue Delay)', desc: 'Standard queuing model for calls.' },
                { val: 'erlang_a', label: 'Erlang A (Abandonments)', desc: 'Factors customer patience/hangup dropouts.' },
                { val: 'erlang_b', label: 'Erlang B (Blocking Limit)', desc: 'Computes blocking rates / busy signals.' },
                { val: 'blended', label: 'Blended Task Concurrency', desc: 'Allows agents to handle multiple chat sessions.' },
                { val: 'workload', label: 'Workload Sizing (Backlog)', desc: 'Direct FTE math (volume * handling time / duration).' }
              ].map((m) => (
                <label
                  key={m.val}
                  className={`flex items-start space-x-3 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    sizingModel === m.val
                      ? 'border-blue-600 bg-blue-50/10 font-medium'
                      : 'border-gray-100 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sizing"
                    checked={sizingModel === m.val}
                    onChange={() => setSizingModel(m.val as SizingModel)}
                    className="mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div>
                    <div className="font-semibold text-gray-800">{m.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* On-the-fly Parameter adjustments */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-gray-400" />
              <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wider">Active Channel Adjustments</h4>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">Target SLA %</label>
                <input
                  type="number"
                  value={currentMergedParams.targetSlaPercent}
                  onChange={(e) => updateOverrideParam('targetSlaPercent', parseInt(e.target.value) || 80)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">SLA Time (s)</label>
                <input
                  type="number"
                  value={currentMergedParams.targetSlaSeconds}
                  onChange={(e) => updateOverrideParam('targetSlaSeconds', parseInt(e.target.value) || 20)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">Shrinkage %</label>
                <input
                  type="number"
                  value={currentMergedParams.shrinkage}
                  onChange={(e) => updateOverrideParam('shrinkage', parseFloat(e.target.value) || 30)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-medium mb-1">Adherence %</label>
                <input
                  type="number"
                  value={currentMergedParams.adherence}
                  onChange={(e) => updateOverrideParam('adherence', parseFloat(e.target.value) || 90)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <button
            id="calculate-sizing"
            onClick={handleRunSizing}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer"
          >
            <span>Run Sizing Calculations</span>
            <Cpu className="w-4 h-4" />
          </button>
        </div>

        {/* Right Sizing charts & grids */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="text-gray-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Staffing Requirements Curves</h4>
              </div>

              {/* Aggregation & View filters */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Date range filters */}
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span className="font-semibold text-[10px] text-gray-400 uppercase">From:</span>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <span className="font-semibold text-[10px] text-gray-400 uppercase">To:</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  {(startDateFilter || endDateFilter) && (
                    <button
                      onClick={() => {
                        setStartDateFilter('');
                        setEndDateFilter('');
                        setCurrentPage(1);
                      }}
                      className="text-rose-500 hover:text-rose-600 font-bold text-[10px] uppercase tracking-wider cursor-pointer ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Aggregation Selector */}
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                  {[
                    { val: 'interval', label: 'Hourly' },
                    { val: 'daily', label: 'Daily' },
                    { val: 'weekly', label: 'Weekly' },
                    { val: 'monthly', label: 'Monthly' },
                    { val: 'yearly', label: 'Yearly' }
                  ].map((lvl) => (
                    <button
                      key={lvl.val}
                      onClick={() => {
                        setAggLevel(lvl.val as AggregationLevel);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer ${
                        aggLevel === lvl.val
                          ? 'bg-white text-gray-800 shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>

                {/* View Modes */}
                <div className="flex items-center space-x-1 bg-gray-150 p-1 rounded-lg text-[10px]">
                  <button 
                    onClick={() => setViewMode('chart')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'chart' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Chart
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'table' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Table
                  </button>
                  <button 
                    onClick={() => setViewMode('both')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'both' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Both
                  </button>
                </div>
              </div>
            </div>

            {sizingResults.length > 0 ? (
              <div>
                {(viewMode === 'chart' || viewMode === 'both') && (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={aggregatedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRawStaff" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFinalStaff" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#f1f1f1' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" name="Raw Queue Required Agents" dataKey="rawRequired" stroke="#94a3b8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRawStaff)" />
                        <Area type="monotone" name="Shrinkage & Adherence Staff" dataKey="finalRequired" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorFinalStaff)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400 space-y-2">
                <TrendingUp className="w-10 h-10 mx-auto text-gray-300" />
                <div className="text-xs font-semibold text-gray-600">Pending sizing computations</div>
                <div className="text-[10px] max-w-sm mx-auto">Click 'Run Sizing Calculations' on the left panel to execute queuing models for all channels.</div>
              </div>
            )}
            <p className="text-[11px] text-gray-400 text-center">
              Chart plots raw staffing (Erlang load) vs. final required roster counts (with shrinkage &amp; adherence buffers) grouped by **{aggLevel.toUpperCase()}**.
            </p>
          </div>

          {sizingResults.length > 0 && (viewMode === 'table' || viewMode === 'both') && (
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Table className="text-gray-500 w-4 h-4" />
                  <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Interval Sizing Roster ({selectedChannel.toUpperCase()})</h4>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium">
                      <th className="py-2">Period Label</th>
                      <th className="py-2 text-right">Summed Volume</th>
                      <th className="py-2 text-right">Workload (Hrs)</th>
                      <th className="py-2 text-right">Average Raw Erlang</th>
                      <th className="py-2 text-right text-blue-600">Average Final Required Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                    {paginatedResults.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/30">
                        <td className="py-2.5 font-normal text-gray-500">{row.label}</td>
                        <td className="py-2.5 text-right text-gray-700">{row.volume}</td>
                        <td className="py-2.5 text-right font-normal text-gray-500">{row.workloadHrs}h</td>
                        <td className="py-2.5 text-right text-gray-700">{row.rawRequired}</td>
                        <td className="py-2.5 text-right text-blue-600 font-bold">{row.finalRequired} agents</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <div>
                  Showing {paginatedResults.length} of {aggregatedData.length} records
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

      {/* Footer link to next flow */}
      {sizingResults.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
          {certifiedSteps[3] ? (
            <button
              id="continue-to-capacity"
              onClick={onNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
            >
              <span>Continue to Capacity &amp; Hiring Plan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>Please Verify &amp; Certify Erlang Staffing above to unlock Capacity planning</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
