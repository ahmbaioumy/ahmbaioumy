import React, { useState, useRef, useEffect } from 'react';
import { HistoricalRow, CleansingMethod, ImputationMethod } from '../types';
import { generateSampleHistoricalData, detectAndCleanseAnomalies, recommendCleansingMethod } from '../utils/cleansingUtils';
import CustomRangeSlider from './CustomRangeSlider';
import { aggregateHistorical, AggregationLevel } from '../utils/aggregationUtils';
import { 
  Upload, 
  Database, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  BarChart2, 
  ShieldAlert, 
  Table, 
  ArrowRight, 
  Sparkles, 
  X,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface UploadCleansingProps {
  historicalData: HistoricalRow[];
  setHistoricalData: React.Dispatch<React.SetStateAction<HistoricalRow[]>>;
  cleansingMethod: CleansingMethod;
  setCleansingMethod: React.Dispatch<React.SetStateAction<CleansingMethod>>;
  onNext: () => void;
  channels: string[];
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

interface CSVMappingState {
  headers: string[];
  rawRows: string[][];
  mappedFields: {
    date: string;
    interval: string;
    volume: string;
    aht: string;
    channel: string;
  };
}

export default function UploadCleansing({
  historicalData,
  setHistoricalData,
  cleansingMethod,
  setCleansingMethod,
  onNext,
  channels,
  certifiedSteps,
  setCertifiedSteps
}: UploadCleansingProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('voice');
  const [sensitivity, setSensitivity] = useState<number>(2.5);
  const [imputationMethod, setImputationMethod] = useState<ImputationMethod>('mean');
  const [aggLevel, setAggLevel] = useState<AggregationLevel>('interval');
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'both'>('both');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column Mapping Overlay State
  const [mappingState, setMappingState] = useState<CSVMappingState | null>(null);

  // Pagination for tables
  const [tablePage, setTablePage] = useState(1);
  const itemsPerPage = 8;

  // Recommendations
  const recommendation = recommendCleansingMethod(historicalData);

  // Auto-certify step 1 when historical data exists
  useEffect(() => {
    if (historicalData && historicalData.length > 0) {
      setCertifiedSteps(prev => ({ ...prev, 1: true }));
    } else {
      setCertifiedSteps(prev => ({ ...prev, 1: false }));
    }
  }, [historicalData, setCertifiedSteps]);

  // Apply cleansing on the selected dataset
  const cleansedData = detectAndCleanseAnomalies(historicalData, cleansingMethod, sensitivity, imputationMethod);

  // Apply cleansed data to state and proceed to next step
  const handleContinue = () => {
    setHistoricalData(cleansedData);
    onNext();
  };

  // Anomaly stats
  const anomaliesCount = cleansedData.filter(d => d.isAnomaly).length;
  const anomaliesPercent = historicalData.length > 0 
    ? Math.round((anomaliesCount / historicalData.length) * 1000) / 10 
    : 0;

  // Handles drag behavior
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Fuzzy match headers helper
  const findFuzzyMatch = (headers: string[], keywords: string[]): string => {
    const match = headers.find(h => keywords.some(k => h.toLowerCase().includes(k)));
    return match || '';
  };

  const handleFileImport = (text: string) => {
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV contains insufficient data rows");

      // Simple CSV cell splitter that respects quotes if present
      const splitCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = splitCSVLine(lines[0]);
      const rawRows = lines.slice(1).map(splitCSVLine);

      // Pre-run fuzzy header match
      const dateMatch = findFuzzyMatch(headers, ['date', 'day', 'calendar', 'datum']);
      const intervalMatch = findFuzzyMatch(headers, ['inter', 'time', 'slot', 'period', 'uhr', 'hour']);
      const volumeMatch = findFuzzyMatch(headers, ['vol', 'call', 'count', 'contact', 'transaction', 'inbound', 'ticket']);
      const ahtMatch = findFuzzyMatch(headers, ['aht', 'handle', 'duration', 'sec', 'time', 'length']);
      const channelMatch = findFuzzyMatch(headers, ['chan', 'type', 'media', 'mode']);

      setMappingState({
        headers,
        rawRows,
        mappedFields: {
          date: dateMatch || headers[0] || '',
          interval: intervalMatch || '',
          volume: volumeMatch || headers[2] || '',
          aht: ahtMatch || headers[3] || '',
          channel: channelMatch || ''
        }
      });
    } catch (err: any) {
      alert(`Invalid File: ${err.message || err}`);
    }
  };

  const executeMapping = () => {
    if (!mappingState) return;
    try {
      const { headers, rawRows, mappedFields } = mappingState;

      const dateIdx = headers.indexOf(mappedFields.date);
      const intervalIdx = mappedFields.interval ? headers.indexOf(mappedFields.interval) : -1;
      const volumeIdx = headers.indexOf(mappedFields.volume);
      const ahtIdx = headers.indexOf(mappedFields.aht);
      const channelIdx = mappedFields.channel ? headers.indexOf(mappedFields.channel) : -1;

      if (dateIdx === -1 || volumeIdx === -1 || ahtIdx === -1) {
        throw new Error("Date, Volume, and AHT must all be mapped correctly.");
      }

      const rows: HistoricalRow[] = [];
      let idCounter = 1;

      rawRows.forEach((cols, idx) => {
        if (cols.length < Math.max(dateIdx, intervalIdx, volumeIdx, ahtIdx) + 1) return;

        const rawDate = cols[dateIdx];
        const rawInterval = intervalIdx !== -1 ? (cols[intervalIdx] || '00:00') : '00:00';
        const volume = parseFloat(cols[volumeIdx]) || 0;
        const aht = parseFloat(cols[ahtIdx]) || 300;
        
        let channel = 'voice';
        if (channelIdx !== -1 && cols[channelIdx]) {
          const rawChan = cols[channelIdx].toLowerCase().trim();
          if (channels.includes(rawChan)) {
            channel = rawChan;
          } else if (rawChan.includes('voice') || rawChan.includes('call')) {
            channel = 'voice';
          } else if (rawChan.includes('chat') || rawChan.includes('mess')) {
            channel = 'chat';
          } else if (rawChan.includes('email') || rawChan.includes('mail')) {
            channel = 'email';
          } else if (rawChan.includes('social') || rawChan.includes('web')) {
            channel = 'social_media';
          }
        }

        const timestamp = `${rawDate}T${rawInterval}:00`;

        rows.push({
          id: `csv-${idCounter++}`,
          timestamp,
          date: rawDate,
          time: rawInterval,
          interval: rawInterval,
          volume,
          aht,
          channel
        });
      });

      if (rows.length === 0) throw new Error("No valid records generated with chosen column mappings.");

      setHistoricalData(rows);
      setMappingState(null);
      // Auto recommend cleansing method
      const autoRec = recommendCleansingMethod(rows);
      setCleansingMethod(autoRec.method);
      setTablePage(1);
    } catch (err: any) {
      alert(`Mapping Execution Failed: ${err.message || err}`);
    }
  };

  // Handles drag-drop and selection triggers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) handleFileImport(evt.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) handleFileImport(evt.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateSample = () => {
    const sample = generateSampleHistoricalData(30, channels);
    setHistoricalData(sample);
    const autoRec = recommendCleansingMethod(sample);
    setCleansingMethod(autoRec.method);
    setTablePage(1);
  };

  // Dynamic grouping logic using modular aggregateHistorical helper
  const aggregatedPoints = aggregateHistorical(cleansedData, aggLevel, selectedChannel);

  const totalPages = Math.ceil(aggregatedPoints.length / itemsPerPage) || 1;
  const paginatedPoints = aggregatedPoints.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage);

  const anomalySamples = cleansedData.filter(d => d.isAnomaly).slice(0, 8);

  return (
    <div className="space-y-8 animate-fadeIn" id="cleansing-tab">
      {/* Certification Banner */}
      {historicalData.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 2: Upload Queue Telemetry &amp; Cleanse</h4>
              <p className="text-xs text-slate-505 leading-relaxed max-w-2xl mt-0.5">
                Please upload your telephony database CSV file or click 'Generate Sample Data' below to begin cleansing and verification.
              </p>
            </div>
          </div>
          <button
            disabled
            className="px-5 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed shrink-0"
          >
            Awaiting Data Ingestion
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Step 2: Ingested &amp; Cleansed Data Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The queue telemetry is automatically verified and cleansed. Downstream forecast modules are now unlocked and ready.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Forecasting</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* ----------------- COLUMN MAPPING OVERLAY MODAL ----------------- */}
      {mappingState && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-3xl w-full p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-blue-600 font-bold text-base">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span>Verify &amp; Map CSV Headers</span>
                </div>
                <p className="text-slate-400 text-xs">
                  Acknowledge and assign which CSV columns relate to the workforce planner fields.
                </p>
              </div>
              <button 
                onClick={() => setMappingState(null)} 
                className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Required Plan Targets</h4>
                
                {[
                  { key: 'date', label: 'Service Date', required: true, desc: 'YYYY-MM-DD or equivalent dates', keywords: ['date', 'day'] },
                  { key: 'interval', label: 'Intraday Interval Time', required: false, desc: 'Optional. HH:MM time stamps (e.g. 08:30). Defaults to 00:00', keywords: ['time', 'interval'] },
                  { key: 'volume', label: 'Call Volume', required: true, desc: 'Contact counts, tickets, chats, or volume metrics', keywords: ['volume', 'count', 'calls'] },
                  { key: 'aht', label: 'Average Handle Time (AHT)', required: true, desc: 'Average handling duration in seconds', keywords: ['aht', 'duration', 'handle'] },
                  { key: 'channel', label: 'Service Channel Queue', required: false, desc: 'Optional. Map to voice, chat, email etc. Defaults to voice', keywords: ['channel', 'media', 'type'] }
                ].map((fld) => (
                  <div key={fld.key} className="space-y-1">
                    <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{fld.label} {fld.required && <strong className="text-rose-500">*</strong>}</span>
                      <span className="text-[10px] text-slate-400 italic">{fld.desc}</span>
                    </label>
                    <select
                      value={mappingState.mappedFields[fld.key as keyof typeof mappingState.mappedFields] || ''}
                      onChange={(e) => {
                        setMappingState({
                          ...mappingState,
                          mappedFields: {
                            ...mappingState.mappedFields,
                            [fld.key]: e.target.value
                          }
                        });
                      }}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                    >
                      {!fld.required && <option value="">-- Optional / Default --</option>}
                      {mappingState.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Data Raw Preview */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Ingested Row Preview (First 4 Rows)</h4>
                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[10px] space-y-2 overflow-x-auto border border-slate-850">
                  <div className="text-slate-500 border-b border-slate-800 pb-1">
                    Headers: {mappingState.headers.join(' | ')}
                  </div>
                  {mappingState.rawRows.slice(0, 4).map((row, i) => (
                    <div key={i} className="whitespace-nowrap hover:text-white transition">
                      Row {i+1}: {row.join(' | ')}
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-200/50 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-amber-800 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Integrity Diagnostics</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Make sure dates match <code className="bg-amber-100 px-1 py-0.5 rounded">YYYY-MM-DD</code> format and intervals are divided correctly into hours or half-hours.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setMappingState(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeMapping}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
              >
                <span>Confirm Column Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Step 1 &amp; 2: Ingest historical queue telemetry</h3>
          <p className="text-gray-500 text-xs leading-relaxed">
            Upload your contact center's historical queue telemetry. Telephony databases frequently contain spikes from system failures, major telecom outages, or missing logs. Statistical models help identify anomalies so they don't corrupt the downstream Erlang capacity profiles.
          </p>

          {/* Upload Dropzone */}
          <div
            id="csv-dropzone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive 
                ? 'border-blue-600 bg-blue-50/20' 
                : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center space-y-2">
              <Upload className="w-10 h-10 text-gray-400" />
              <div className="text-xs font-semibold text-gray-700">Drag &amp; Drop contact center CSV here</div>
              <div className="text-[11px] text-gray-400">Features automatic fuzzy header matching &amp; preview mapper!</div>
              <button
                type="button"
                className="mt-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                Browse Files
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2">
            <span className="text-gray-400">Don't have a CSV handy? Let the planner engine generate synthetic 30-day intervals for you instantly.</span>
            <button
              id="generate-sample-data"
              onClick={handleGenerateSample}
              className="flex items-center space-x-1.5 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Generate Sample Data</span>
            </button>
          </div>
        </div>

        {/* Dynamic Model Cleansing Selector Panel */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="text-blue-600 w-5 h-5" />
              <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wider">Statistical Cleansing Method</h4>
            </div>

            {historicalData.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl text-xs space-y-1.5">
                <span className="font-bold text-blue-800">Best Recommendation:</span>
                <span className="text-blue-700 block text-[11px] font-medium leading-relaxed">
                  {recommendation.explanation}
                </span>
                <button
                  onClick={() => setCleansingMethod(recommendation.method)}
                  className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-blue-800 hover:underline cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply Recommended Method ({recommendation.method.replace('_', ' ').toUpperCase()})</span>
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] text-gray-400 font-medium">Select Cleansing Algorithm</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { val: 'zscore', label: 'Z-Score Standard Deviation', desc: 'Identifies spikes outside standard deviation limits.' },
                  { val: 'iqr', label: 'Interquartile Range (IQR)', desc: 'Robust boxplot bounds; clips reporting outages.' },
                  { val: 'moving_median', label: 'Rolling Median (MAD)', desc: 'Smooths local variance but preserves cyclical peak shapes.' },
                  { val: 'none', label: 'No Cleansing (Keep Raw)', desc: 'Bypass cleansing; raw uploaded data feeds sizing.' }
                ].map((m) => (
                  <label
                    key={m.val}
                    className={`flex items-start space-x-3 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      cleansingMethod === m.val
                        ? 'border-blue-600 bg-blue-50/10'
                        : 'border-gray-100 hover:bg-gray-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cleansing"
                      checked={cleansingMethod === m.val}
                      onChange={() => setCleansingMethod(m.val as CleansingMethod)}
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

            {cleansingMethod !== 'none' && (
              <div className="space-y-4 pt-3 border-t border-gray-100">
                <CustomRangeSlider
                  label="Anomaly Sensitivity Threshold"
                  min={1.2}
                  max={4.0}
                  step={0.1}
                  value={sensitivity}
                  onChange={(val) => setSensitivity(val)}
                  unit=" σ"
                  desc="Lower sigma limits flag more aggressively; higher sigmas clip only extreme outliers."
                  accentClass="accent-blue-600"
                />

                <div className="space-y-2">
                  <label className="block text-[11px] text-gray-400 font-medium">Select Imputation Method</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { val: 'mean', label: 'Rolling Mean (Average)', desc: 'Replaces anomaly data with the historical average of this interval.' },
                      { val: 'median', label: 'Rolling Median', desc: 'Replaces with median value, highly resistant to extreme skews.' },
                      { val: 'forward_fill', label: 'Forward Fill (Prev Value)', desc: 'Fills with the last valid non-anomalous reading.' },
                      { val: 'zero', label: 'Constant Zero Drop', desc: 'Sets anomalous intervals to 0 volume.' },
                      { val: 'none', label: 'No Replacement (Keep Spikes)', desc: 'Flags and highlights the anomaly but preserves raw spikes.' }
                    ].map((imp) => (
                      <label
                        key={imp.val}
                        className={`flex items-start space-x-3 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          imputationMethod === imp.val
                            ? 'border-blue-600 bg-blue-50/10'
                            : 'border-gray-100 hover:bg-gray-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="imputation"
                          checked={imputationMethod === imp.val}
                          onChange={() => setImputationMethod(imp.val as ImputationMethod)}
                          className="mt-0.5 accent-blue-600 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-gray-800">{imp.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{imp.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4 flex items-center justify-between text-xs">
            <div className="text-gray-400">
              Total Records: <strong className="text-gray-700">{historicalData.length}</strong>
            </div>
            {cleansingMethod !== 'none' && (
              <div className="text-rose-600 font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{anomaliesCount} anomalies ({anomaliesPercent}%)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {historicalData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Visualizations chart & grid: Original vs Cleansed curve with multi-aggregation filters */}
          <div className="lg:col-span-2 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
              <div className="flex items-center space-x-2">
                <BarChart2 className="text-gray-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Transaction Telemetry Profiler</h4>
              </div>

              {/* View options selectors */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Aggregation Filter */}
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                  {[
                    { val: 'interval', label: 'Hourly/Interval' },
                    { val: 'daily', label: 'Daily' },
                    { val: 'weekly', label: 'Weekly' },
                    { val: 'monthly', label: 'Monthly' },
                    { val: 'yearly', label: 'Yearly' }
                  ].map((lvl) => (
                    <button
                      key={lvl.val}
                      onClick={() => {
                        setAggLevel(lvl.val as AggregationLevel);
                        setTablePage(1);
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

                {/* View Mode Toggle */}
                <div className="flex items-center space-x-1 bg-gray-150 p-1 rounded-lg text-[10px]">
                  <button 
                    onClick={() => setViewMode('chart')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'chart' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Chart Only
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'table' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Table Only
                  </button>
                  <button 
                    onClick={() => setViewMode('both')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'both' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Both
                  </button>
                </div>

                {/* Focus channel */}
                <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-lg">
                  {channels.map((chan) => (
                    <button
                      key={chan}
                      onClick={() => setSelectedChannel(chan)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-md transition cursor-pointer capitalize ${
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

            {/* Rendering views */}
            {(viewMode === 'chart' || viewMode === 'both') && (
              <div className="space-y-2">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={aggregatedPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCleansed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#f1f1f1' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" name="Raw Volume" dataKey="rawVolume" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRaw)" />
                      <Area type="monotone" name="Cleansed Volume" dataKey="cleansedVolume" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCleansed)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Aggregating data points by **{aggLevel.toUpperCase()}** parameters for focusing.
                </p>
              </div>
            )}

            {(viewMode === 'table' || viewMode === 'both') && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <div className="flex items-center space-x-1.5">
                    <Table className="w-4 h-4 text-gray-500" />
                    <span>Aggregated Workload Inventory ({aggLevel.toUpperCase()})</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-medium">
                        <th className="py-2">Period Label</th>
                        <th className="py-2 text-right">Raw Ingest Volume</th>
                        <th className="py-2 text-right">Cleansed Volume</th>
                        <th className="py-2 text-right">Average AHT (s)</th>
                        <th className="py-2 text-right">Anomalies Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                      {paginatedPoints.map((pt, i) => (
                        <tr key={i} className="hover:bg-gray-50/30">
                          <td className="py-2">{pt.label}</td>
                          <td className="py-2 text-right">{pt.rawVolume}</td>
                          <td className="py-2 text-right text-blue-600 font-bold">{pt.cleansedVolume}</td>
                          <td className="py-2 text-right font-normal text-gray-400">{pt.avgAht}s</td>
                          <td className="py-2 text-right">
                            {pt.anomalyCount > 0 ? (
                              <span className="text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-sm font-semibold">{pt.anomalyCount} outliers</span>
                            ) : (
                              <span className="text-emerald-500 font-normal">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Page {tablePage} of {totalPages} ({aggregatedPoints.length} total entries)</span>
                  <div className="flex space-x-1.5">
                    <button
                      disabled={tablePage === 1}
                      onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                      className="px-2 py-0.5 border border-gray-200 rounded-md disabled:opacity-50 cursor-pointer"
                    >
                      Prev
                    </button>
                    <button
                      disabled={tablePage === totalPages}
                      onClick={() => setTablePage(prev => Math.min(totalPages, prev + 1))}
                      className="px-2 py-0.5 border border-gray-200 rounded-md disabled:opacity-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right side panel: Anomaly telemetry log */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
                <ShieldAlert className="text-rose-500 w-5 h-5" />
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Detected Outlier Registry</h4>
              </div>

              {anomaliesCount === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-xs font-semibold">No outliers flagged</div>
                  <div className="text-[10px]">Data is statistically pure at this threshold.</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {anomalySamples.map((row) => (
                    <div key={row.id} className="p-2.5 rounded-xl bg-rose-50/30 border border-rose-100/50 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-rose-700 capitalize text-[10px] bg-rose-100/50 px-1.5 py-0.5 rounded-sm">{row.channel}</span>
                          <span className="text-[10px] text-gray-400">{row.date} {row.time}</span>
                        </div>
                        <div className="text-[11px] font-medium text-gray-700 mt-1">Anomaly: {row.anomalyReason || 'Abnormal spikes'}</div>
                      </div>
                      <div className="text-right text-[10px]">
                        <div className="text-gray-400">Raw: <strong className="text-rose-600">{row.volume}</strong></div>
                        <div className="text-gray-400">Cleansed: <strong className="text-blue-600">{row.cleansedVolume}</strong></div>
                      </div>
                    </div>
                  ))}
                  {anomaliesCount > 8 && (
                    <div className="text-center text-[10px] text-gray-400 pt-1">
                      And {anomaliesCount - 8} other detected outliers...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              {certifiedSteps[1] ? (
                <button
                  id="continue-to-forecasting"
                  onClick={handleContinue}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
                >
                  <span>Continue to Forecasting</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100">
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                  <span>Please Confirm &amp; Certify Data Cleansing above to unlock Forecasting</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-100 p-16 rounded-2xl text-center space-y-4">
          <Database className="w-12 h-12 text-gray-400 mx-auto" />
          <h4 className="text-sm font-semibold text-gray-700">No telemetry dataset loaded</h4>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Please drag and drop your telephony database CSV file or click 'Generate Sample Data' to start building a workforce plan instantly.
          </p>
        </div>
      )}
    </div>
  );
}
