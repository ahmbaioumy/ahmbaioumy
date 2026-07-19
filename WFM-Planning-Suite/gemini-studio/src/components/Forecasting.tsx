import React, { useState } from 'react';
import { HistoricalRow, ForecastRow, ForecastingModel } from '../types';
import { generateForecast, recommendForecastingModel } from '../utils/forecastingUtils';
import { aggregateForecast, AggregationLevel } from '../utils/aggregationUtils';
import { 
  TrendingUp, 
  RefreshCw, 
  BarChart, 
  Calendar, 
  ChevronRight, 
  Filter, 
  Check,
  Table,
  Sparkles,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface ForecastingProps {
  historicalData: HistoricalRow[];
  forecastData: ForecastRow[];
  setForecastData: React.Dispatch<React.SetStateAction<ForecastRow[]>>;
  forecastingModel: ForecastingModel;
  setForecastingModel: React.Dispatch<React.SetStateAction<ForecastingModel>>;
  onNext: () => void;
  channels: string[];
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function Forecasting({
  historicalData,
  forecastData,
  setForecastData,
  forecastingModel,
  setForecastingModel,
  onNext,
  channels,
  certifiedSteps,
  setCertifiedSteps
}: ForecastingProps) {
  const [horizonDays, setHorizonDays] = useState<number>(30); // Default monthly plan
  const [selectedChannel, setSelectedChannel] = useState<string>('voice');
  const [searchDate, setSearchDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [aggLevel, setAggLevel] = useState<AggregationLevel>('daily');
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'both'>('both');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const recommendation = recommendForecastingModel(historicalData);

  // Trigger forecast generation on button click
  const handleCalculateForecast = () => {
    const cleansedHist = historicalData.map(d => ({
      ...d,
      volume: d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume,
      aht: d.cleansedAht !== undefined ? d.cleansedAht : d.aht
    }));
    const res = generateForecast(cleansedHist, forecastingModel, horizonDays, channels);
    setForecastData(res);
    setCurrentPage(1);
  };

  // Filter historical and forecast data by date range if provided
  const filteredHist = historicalData.filter(h => {
    if (startDateFilter && h.date < startDateFilter) return false;
    if (endDateFilter && h.date > endDateFilter) return false;
    return true;
  });

  const filteredForecast = forecastData.filter(f => {
    if (startDateFilter && f.date < startDateFilter) return false;
    if (endDateFilter && f.date > endDateFilter) return false;
    return true;
  });

  // Grouped forecast vs actuals
  const groupedData = aggregateForecast(filteredHist, filteredForecast, aggLevel, selectedChannel);

  // Pagination for table
  const itemsPerPage = 8;
  const totalPages = Math.ceil(groupedData.length / itemsPerPage) || 1;
  const paginatedData = groupedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatHorizonLabel = (days: number) => {
    if (days === 7) return 'Weekly Staffing Plan';
    if (days === 30) return 'Monthly (30-Day) Plan';
    if (days === 90) return 'Quarterly (90-Day) Plan';
    return 'Yearly (365-Day) Business Plan';
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="forecasting-tab">
      {/* Certification Banner */}
      {forecastData.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 3: Forecast Generation</h4>
              <p className="text-xs text-slate-505 leading-relaxed max-w-2xl mt-0.5">
                Configure your planning horizon and mathematical models, then click 'Generate Forecast' to build workload trends.
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
              <h4 className="text-sm font-bold text-emerald-900">Step 3: Forecast Workload Trends Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The workload forecast has been successfully simulated and validated automatically. Downstream Erlang staffing modules are active.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Sizing</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left configurations */}
        <div className="md:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
            <TrendingUp className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Forecast Profile Settings</h3>
          </div>

          {/* Planning Horizon select */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Planning Horizon Window</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 7, label: '7-Day Plan' },
                { val: 30, label: '30-Day Plan' },
                { val: 90, label: '90-Day Plan' },
                { val: 365, label: 'Yearly Plan' }
              ].map((h) => (
                <button
                  key={h.val}
                  onClick={() => {
                    setHorizonDays(h.val);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                    horizonDays === h.val
                      ? 'border-blue-600 bg-blue-50/20 text-blue-700'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation prompt */}
          {historicalData.length > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl text-xs space-y-1.5">
              <span className="font-bold text-blue-800">Cleansed Data Diagnostics:</span>
              <span className="text-blue-700 block text-[11px] font-medium leading-relaxed">
                {recommendation.explanation}
              </span>
              <button
                onClick={() => setForecastingModel(recommendation.model)}
                className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-blue-800 hover:underline cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Select Recommended ({recommendation.model.toUpperCase()})</span>
              </button>
            </div>
          )}

          {/* Model selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecasting Model Selection</label>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {[
                { val: 'average', label: 'Simple Interval Average', desc: 'Baseline static average of matching slots.' },
                { val: 'moving_average', label: 'Day-of-Week Moving Avg', desc: 'Averages recent weekdays. Good for volatile short-runs.' },
                { val: 'trend', label: 'Linear Growth Trend Projection', desc: 'Fits linear regression slopes across history.' },
                { val: 'seasonal_hw', label: 'Double Holt-Winters Seasonal', desc: 'Weaves growth momentum and cyclic weekly seasonality.' },
                { val: 'prophet_style', label: 'Prophet Additive Decomposition', desc: 'Isolates global growth, weekday weights, and intraday peaks.' },
                { val: 'sarima_approx', label: 'SARIMA Autoregressive Lag', desc: 'Blends weekday cycle lags and linear trend coefficients.' },
                { val: 'croston_intermittent', label: 'Croston Intermittent demand', desc: 'Separates demand size and spacing. Ideal for sparse channels.' },
                { val: 'ensemble_blend', label: 'Consensus Ensemble Blend', desc: 'Consensus blend of Holt-Winters, Prophet, and Moving Average.' }
              ].map((m) => (
                <label
                  key={m.val}
                  className={`flex items-start space-x-3 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    forecastingModel === m.val
                      ? 'border-blue-600 bg-blue-50/10'
                      : 'border-gray-100 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="forecasting"
                    checked={forecastingModel === m.val}
                    onChange={() => setForecastingModel(m.val as ForecastingModel)}
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

          <button
            id="run-forecast"
            onClick={handleCalculateForecast}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer"
          >
            <span>Run Forecast Computations</span>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right side charts + overview table */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2">
                <BarChart className="text-gray-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Volume Transition Curve (Actuals vs Projected)</h4>
              </div>

              {/* Advanced view option filters */}
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
                    className="border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <span className="font-semibold text-[10px] text-gray-400 uppercase">To:</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
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

                {/* View Mode */}
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

                {/* Display channels toggler */}
                <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-lg">
                  {channels.map((chan) => (
                    <button
                      key={chan}
                      onClick={() => setSelectedChannel(chan)}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer capitalize ${
                        selectedChannel === chan
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {chan}
                    </button>
                  ))}
                </div>

              </div>
            </div>

            {forecastData.length > 0 ? (
              <div className="space-y-4">
                {(viewMode === 'chart' || viewMode === 'both') && (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={groupedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#f1f1f1' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" name="Actual Ingest Volume" dataKey="actualVolume" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" name="Forecast Volume" dataKey="forecastVolume" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400 space-y-2">
                <Calendar className="w-10 h-10 mx-auto text-gray-300" />
                <div className="text-xs font-semibold text-gray-600">Pending calculation</div>
                <div className="text-[10px] max-w-sm mx-auto">Click 'Run Forecast Computations' on the sidebar panel to generate the staffing horizon model.</div>
              </div>
            )}
            <p className="text-[11px] text-gray-400 text-center">
              Displaying historic actual records mapped side-by-side with prospective projected load curves by **{aggLevel.toUpperCase()}**.
            </p>
          </div>

          {/* Table Breakdown of Forecast */}
          {forecastData.length > 0 && (viewMode === 'table' || viewMode === 'both') && (
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Table className="text-gray-500 w-4 h-4" />
                  <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Forecast Output Grid ({aggLevel.toUpperCase()})</h4>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium">
                      <th className="py-2">Period Label</th>
                      <th className="py-2 text-right">Actual Volume</th>
                      <th className="py-2 text-right">Projected Volume</th>
                      <th className="py-2 text-right">Variance / Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600">
                    {paginatedData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/30">
                        <td className="py-2.5 font-medium">{row.label}</td>
                        <td className="py-2.5 text-right font-normal text-gray-500">{row.actualVolume > 0 ? row.actualVolume : '—'}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">{row.forecastVolume}</td>
                        <td className="py-2.5 text-right">
                          {row.actualVolume > 0 ? (
                            <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                              row.variance >= 0 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {row.variance >= 0 ? `+${row.variance}` : row.variance}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <div>
                  Showing {paginatedData.length} of {groupedData.length} records
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

      {/* Footer next link */}
      {forecastData.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
          {certifiedSteps[2] ? (
            <button
              id="continue-to-sizing"
              onClick={onNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
            >
              <span>Continue to Sizing &amp; Erlang Models</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>Please Review &amp; Certify Forecast Trends above to unlock Sizing &amp; Erlang Models</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
