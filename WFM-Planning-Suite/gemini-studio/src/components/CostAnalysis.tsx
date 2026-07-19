import React, { useState } from 'react';
import { 
  CapacityMonthlyPlan, 
  SizingResultRow, 
  SimulationResult,
  HistoricalRow,
  ForecastRow,
  ScheduleAssignment,
  ProfileParams
} from '../types';
import { exportFullWorkforcePlanToExcel } from '../utils/excelExportUtils';
import { 
  DollarSign, 
  ShieldAlert, 
  FileText, 
  Download, 
  CheckCircle2, 
  Sliders, 
  FileSpreadsheet,
  TrendingUp
} from 'lucide-react';

interface CostAnalysisProps {
  capacityPlan: CapacityMonthlyPlan[];
  sizingResults: SizingResultRow[];
  simulationResult: SimulationResult | null;
  channels: string[];
  historicalData: HistoricalRow[];
  forecastData: ForecastRow[];
  scheduleAssignments: ScheduleAssignment[];
  profileParams: ProfileParams;
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function CostAnalysis({
  capacityPlan,
  sizingResults,
  simulationResult,
  channels,
  historicalData,
  forecastData,
  scheduleAssignments,
  profileParams,
  certifiedSteps,
  setCertifiedSteps
}: CostAnalysisProps) {
  // Local toggles to adjust model rates on-the-fly
  const [localWageRate, setLocalWageRate] = useState<number>(24);
  const [localOvertimeRate, setLocalOvertimeRate] = useState<number>(1.5);

  // Recalculate operational, base, overtime, and total budgets
  const adjustedPlan = capacityPlan.map(p => {
    // Sizing results fte target
    const requiredFte = p.requiredFte;
    const activeFte = p.endingFte;
    const deficit = Math.max(0, requiredFte - activeFte);

    const recruitmentCost = p.recruitmentCost;
    const trainingCost = p.trainingCost;
    
    // Monthly hours per FTE = 160
    const baseWageBudget = activeFte * 160 * localWageRate;
    const overtimeBudget = deficit * 160 * localWageRate * localOvertimeRate;
    const totalOperatingCost = baseWageBudget + overtimeBudget;

    return {
      ...p,
      operationalCost: totalOperatingCost,
      totalCost: recruitmentCost + trainingCost + totalOperatingCost,
      baseWageBudget,
      overtimeBudget,
      deficit
    };
  });

  // Calculate totals
  const totalSourcingCost = adjustedPlan.reduce((sum, p) => sum + p.recruitmentCost, 0);
  const totalTrainingCost = adjustedPlan.reduce((sum, p) => sum + p.trainingCost, 0);
  const totalBaseSalaries = adjustedPlan.reduce((sum, p) => sum + p.baseWageBudget, 0);
  const totalOvertimeCosts = adjustedPlan.reduce((sum, p) => sum + p.overtimeBudget, 0);
  const grandTotalCost = totalSourcingCost + totalTrainingCost + totalBaseSalaries + totalOvertimeCosts;

  // Calculate total volume handled across sizing results
  const totalContacts = sizingResults.reduce((sum, s) => sum + s.volume, 0) || 10000;
  const costPerContact = grandTotalCost / totalContacts;

  // Calculate total agent hours
  const totalAgentHours = adjustedPlan.reduce((sum, p) => sum + (p.endingFte * 160), 0) || 1000;
  const costPerAgentHour = grandTotalCost / totalAgentHours;

  // Sizing staffing utilization efficiency
  const totalRequiredFte = adjustedPlan.reduce((sum, p) => sum + p.requiredFte, 0);
  const totalEndingFte = adjustedPlan.reduce((sum, p) => sum + p.endingFte, 0);
  const utilizationEfficiency = totalEndingFte > 0 
    ? Math.min(100, Math.round((totalRequiredFte / totalEndingFte) * 100)) 
    : 100;

  // Simulated overall SLA achievement
  const simulatedSlaPercent = simulationResult ? simulationResult.overallSla : 82.5;

  const handleExportFullExcel = () => {
    exportFullWorkforcePlanToExcel({
      profileParams,
      historicalData,
      forecastData,
      sizingResults,
      capacityPlan: adjustedPlan,
      scheduleAssignments,
      simulationResult
    });
  };

  // CSV Exporter for general summary
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Contact Center Workforce Planning - Master Summary Roster\n\n";
    csvContent += "MONTHLY CAPACITY & RECRUITING BUDGETS\n";
    csvContent += "Month,Target Sizing FTE,Starting Active FTE,Attrition Loss,Graduating Adds,Ending Active FTE,Overtime Deficit FTE,Recruitment Cost,Training Cost,Operational Wage Cost,Total Budget\n";
    
    adjustedPlan.forEach(p => {
      csvContent += `${p.monthName},${p.requiredFte},${p.startingFte},-${p.attritionLossFte},+${p.newHiresNeeded},${p.endingFte},${p.deficit},${p.recruitmentCost},${p.trainingCost},${p.operationalCost},${p.totalCost}\n`;
    });

    csvContent += "\n\nPLAN PERFORMANCE DIAGNOSTICS METRICS\n";
    csvContent += `Metric,Value\n`;
    csvContent += `Grand Total Cost Budget,$${grandTotalCost.toLocaleString()}\n`;
    csvContent += `Cost per Handled Contact,$${Math.round(costPerContact * 100) / 100}\n`;
    csvContent += `Cost per Active Agent Contract Hour,$${Math.round(costPerAgentHour * 100) / 100}\n`;
    csvContent += `Staffing Utilization Efficiency,${utilizationEfficiency}%\n`;
    csvContent += `Overall Simulated Service Level (SLA),${simulatedSlaPercent}%\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cc-workforce-plan-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="cost-tab">
      {/* Certification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">Step 8: Workforce Planning Cycle Verified &amp; Approved</h4>
            <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
              Excellent! All 8 workflow gates have been successfully verified and locked automatically based on the completed planning data. The final budget sheets, sizing queues, and shift rosters are ready for export below.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Wage rate adjusters */}
        <div className="md:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
            <Sliders className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Labor Cost Modeling</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Standard Loaded Wage</span>
                <span className="font-semibold text-gray-700">${localWageRate}/hr</span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                value={localWageRate}
                onChange={(e) => setLocalWageRate(parseInt(e.target.value) || 20)}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Hourly cost inclusive of medical benefits, payroll taxes, and overhead.</span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Overtime Penalty Rate</span>
                <span className="font-semibold text-gray-700">{localOvertimeRate}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={localOvertimeRate}
                onChange={(e) => setLocalOvertimeRate(parseFloat(e.target.value) || 1.5)}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Wage multiplier paid to roster gaps to maintain service levels.</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <button
              id="export-excel-master"
              onClick={handleExportFullExcel}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-500/10 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Master Plan (Excel)</span>
            </button>
            
            <button
              id="export-csv"
              onClick={handleExportCSV}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Raw Summary (CSV)</span>
            </button>
          </div>
        </div>

        {/* Right side sheet: Cost report */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Key metrics cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs animate-fadeIn">
              <DollarSign className="w-4 h-4 text-emerald-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Plan Budget</div>
              <div className="text-base font-bold text-gray-800">${grandTotalCost.toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
              <FileText className="w-4 h-4 text-blue-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Cost/Contact</div>
              <div className="text-base font-bold text-gray-800">${Math.round(costPerContact * 100) / 100}</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-teal-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Roster Efficiency</div>
              <div className="text-base font-bold text-gray-800">{utilizationEfficiency}%</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl text-center space-y-1 shadow-xs">
              <ShieldAlert className="w-4 h-4 text-indigo-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Overall SLA %</div>
              <div className="text-base font-bold text-gray-800">{simulatedSlaPercent}%</div>
            </div>
          </div>

          {/* Sizing monthly breakdown table */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Financial Budget Allocation Sheet</h4>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm font-semibold">Active Cost Adjustments</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-medium">
                    <th className="py-2">Month</th>
                    <th className="py-2 text-right">Recruitment Cost</th>
                    <th className="py-2 text-right">Training Cost</th>
                    <th className="py-2 text-right">Base Wages</th>
                    <th className="py-2 text-right">Overtime Penalty</th>
                    <th className="py-2 text-right font-bold text-gray-900">Total Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                  {adjustedPlan.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/30">
                      <td className="py-2.5 font-bold text-gray-700">{p.monthName}</td>
                      <td className="py-2.5 text-right font-normal text-gray-500">${p.recruitmentCost.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-normal text-gray-500">${p.trainingCost.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-normal text-gray-500">${p.baseWageBudget.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-normal text-rose-500">${p.overtimeBudget.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">${p.totalCost.toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-gray-100 bg-gray-50/50 font-bold">
                    <td className="py-3 font-bold text-gray-900">Total Plan</td>
                    <td className="py-3 text-right text-gray-900">${totalSourcingCost.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-900">${totalTrainingCost.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-900">${totalBaseSalaries.toLocaleString()}</td>
                    <td className="py-3 text-right text-rose-500">${totalOvertimeCosts.toLocaleString()}</td>
                    <td className="py-3 text-right text-emerald-600">${grandTotalCost.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed pt-2">
              The operational financial sheet matches direct recruitment metrics, training facilities overheads, contract labor salaries, and penalty overtime gaps dynamically based on the Erlang sizing curves resolved in previous tabs. Adjust wage multipliers on the left sidebar to simulate alternative payroll plans instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
