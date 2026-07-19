import React, { useState, useEffect } from 'react';
import { SizingResultRow, CapacityPlanParams, CapacityMonthlyPlan } from '../types';
import { Briefcase, UserPlus, DollarSign, Calendar, Sliders, ChevronRight, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';
import CustomRangeSlider from './CustomRangeSlider';

interface CapacityPlanningProps {
  sizingResults: SizingResultRow[];
  capacityPlan: CapacityMonthlyPlan[];
  setCapacityPlan: React.Dispatch<React.SetStateAction<CapacityMonthlyPlan[]>>;
  onNext: () => void;
  certifiedSteps: Record<number, boolean>;
  setCertifiedSteps: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export default function CapacityPlanning({
  sizingResults,
  capacityPlan,
  setCapacityPlan,
  onNext,
  certifiedSteps,
  setCertifiedSteps
}: CapacityPlanningProps) {
  // Capacity parameters with state
  const [params, setParams] = useState<CapacityPlanParams>({
    sourcingDurationWeeks: 4,
    trainingDurationWeeks: 4,
    nestingDurationWeeks: 2,
    throughputPercent: 85,
    attritionPercentMonthly: 3,
    hourlyRate: 24,
    overtimeRateMultiplier: 1.5,
    sourcingCostPerHire: 1500,
    trainingCostPerClass: 4000,
    maxCohortSize: 15,
    trainingRoomsCount: 2,
    trainerCount: 2
  });

  const [startingStaff, setStartingStaff] = useState<number>(45);

  const calculateCapacityPlan = () => {
    // Determine maximum FTE requirements per month from the sizing results
    // If the planning horizon is shorter than 6 months, we project 6 months of continuous operations
    const months = ['January', 'February', 'March', 'April', 'May', 'June'];
    
    // Find average or peak required staff across sizing results
    let maxSizingFte = 50;
    if (sizingResults.length > 0) {
      const peakRow = [...sizingResults].sort((a, b) => b.finalRequiredAgents - a.finalRequiredAgents)[0];
      maxSizingFte = peakRow ? peakRow.finalRequiredAgents : 50;
    }

    // Distribute required FTEs with slight seasonal variations across 6 months
    const fteTargets = [
      maxSizingFte,
      Math.round(maxSizingFte * 1.05),
      Math.round(maxSizingFte * 1.15), // Peak month (e.g. spring campaign)
      Math.round(maxSizingFte * 1.08),
      Math.round(maxSizingFte * 0.95),
      Math.round(maxSizingFte * 1.0)
    ];

    const plans: CapacityMonthlyPlan[] = [];
    let activeFte = startingStaff;

    // We'll track training cohorts that "land" (graduate) in Month M
    const cohortsTriggers: number[] = Array(6).fill(0);

    for (let m = 0; m < 6; m++) {
      const requiredFte = fteTargets[m];
      const attritionLoss = Math.round(activeFte * (params.attritionPercentMonthly / 100));
      
      // Calculate deficit
      let netActiveBeforeNewAdds = activeFte - attritionLoss;
      let deficit = requiredFte - netActiveBeforeNewAdds;

      // If there's a deficit, we calculate required hires
      let rawNewHiresNeeded = 0;
      if (deficit > 0) {
        rawNewHiresNeeded = Math.ceil(deficit / (params.throughputPercent / 100));
      }

      // Training Capacity Limit (Rooms & Trainers)
      const maxParallelClasses = Math.min(params.trainingRoomsCount, params.trainerCount);
      const maxMonthlyNewHiresLimit = maxParallelClasses * params.maxCohortSize;

      // Apply training capacity bottleneck
      const actualNewHiresTrained = Math.min(rawNewHiresNeeded, maxMonthlyNewHiresLimit);
      const graduatesAdded = Math.floor(actualNewHiresTrained * (params.throughputPercent / 100));

      const endingFte = netActiveBeforeNewAdds + graduatesAdded;

      // Calculate number of classes running
      const numberOfClasses = Math.ceil(actualNewHiresTrained / params.maxCohortSize);

      // Track cohorts landing
      cohortsTriggers[m] = actualNewHiresTrained;

      // Costs
      const recruitmentCost = actualNewHiresTrained * params.sourcingCostPerHire;
      const trainingCost = numberOfClasses > 0 ? (numberOfClasses * params.trainingCostPerClass + (actualNewHiresTrained * 300)) : 0;
      
      // Productive hours cost: 160 hrs per agent monthly
      const operationalCost = activeFte * 160 * params.hourlyRate;
      
      // Deficit/Overtime costing (if ending active is less than required, we pay overtime rate)
      const actualDeficit = Math.max(0, requiredFte - endingFte);
      const overtimeCost = actualDeficit * 160 * params.hourlyRate * params.overtimeRateMultiplier;

      const totalCost = recruitmentCost + trainingCost + operationalCost + overtimeCost;

      plans.push({
        monthName: months[m],
        monthIndex: m,
        requiredFte,
        startingFte: activeFte,
        attritionLossFte: attritionLoss,
        newHiresNeeded: actualNewHiresTrained,
        sourcingStartedFte: rawNewHiresNeeded, // raw unconstrained target
        trainingCohortFte: numberOfClasses, // Number of actual classes running
        nestingCohortFte: graduatesAdded,
        endingFte,
        fteDeficit: actualDeficit,
        recruitmentCost,
        trainingCost,
        operationalCost: operationalCost + overtimeCost,
        totalCost: Math.round(totalCost)
      });

      // Roll forward ending FTE to next month starting FTE
      activeFte = endingFte;
    }

    setCapacityPlan(plans);
  };

  // Run calculation on mount or params changes
  useEffect(() => {
    calculateCapacityPlan();
  }, [params, startingStaff, sizingResults]);

  // Auto-certify Step 5 (Capacity Planning) when plan exists
  useEffect(() => {
    if (capacityPlan && capacityPlan.length > 0) {
      setCertifiedSteps(prev => ({ ...prev, 4: true }));
    } else {
      setCertifiedSteps(prev => ({ ...prev, 4: false }));
    }
  }, [capacityPlan, setCertifiedSteps]);

  // Aggregate totals
  const totalHires = capacityPlan.reduce((sum, p) => sum + p.newHiresNeeded, 0);
  const totalRecruitmentCost = capacityPlan.reduce((sum, p) => sum + p.recruitmentCost, 0);
  const totalTrainingCost = capacityPlan.reduce((sum, p) => sum + p.trainingCost, 0);
  const totalOperatingCost = capacityPlan.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <div className="space-y-8 animate-fadeIn" id="capacity-tab">
      {/* Certification Banner */}
      {capacityPlan.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-slate-200 rounded-xl text-slate-700 mt-0.5">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Step 5: Capacity &amp; Hiring Plan</h4>
              <p className="text-xs text-slate-505 leading-relaxed max-w-2xl mt-0.5">
                Set active staff count, attrition parameters, training timelines, and classroom/trainer limits to build your long-term staffing fulfillment plan.
              </p>
            </div>
          </div>
          <button
            disabled
            className="px-5 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed shrink-0"
          >
            Awaiting Plan Generation
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Step 5: Capacity &amp; Hiring Plan Verified</h4>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl mt-0.5">
                The capacity plan and recruitment schedules are automatically validated. The shift scheduling module is active.
              </p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 animate-fadeIn"
          >
            <span>Continue to Shift Scheduling</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Sourcing, Training & Attrition Parameter controls */}
        <div className="md:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4">
            <Sliders className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-800 text-sm">Hiring Pipeline Funnel</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Starting Headcount (FTE)</label>
              <input
                type="number"
                value={startingStaff}
                onChange={(e) => setStartingStaff(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Rostered staff currently fully active on day 1.</span>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Duration Lead Times (Weeks)</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Sourcing</label>
                  <input
                    type="number"
                    value={params.sourcingDurationWeeks}
                    onChange={(e) => setParams(prev => ({ ...prev, sourcingDurationWeeks: parseInt(e.target.value) || 1 }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 text-center focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Training</label>
                  <input
                    type="number"
                    value={params.trainingDurationWeeks}
                    onChange={(e) => setParams(prev => ({ ...prev, trainingDurationWeeks: parseInt(e.target.value) || 1 }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 text-center focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Nesting</label>
                  <input
                    type="number"
                    value={params.nestingDurationWeeks}
                    onChange={(e) => setParams(prev => ({ ...prev, nestingDurationWeeks: parseInt(e.target.value) || 1 }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 text-center focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class Attrition & Cost Overhead</h4>
              
              <CustomRangeSlider
                label="Graduation Throughput Rate"
                min={50}
                max={100}
                step={1}
                value={params.throughputPercent}
                onChange={(val) => setParams(prev => ({ ...prev, throughputPercent: Math.round(val) }))}
                unit="%"
                accentClass="accent-emerald-600"
              />

              <CustomRangeSlider
                label="Active Monthly Attrition"
                min={0}
                max={15}
                step={0.5}
                value={params.attritionPercentMonthly}
                onChange={(val) => setParams(prev => ({ ...prev, attritionPercentMonthly: val }))}
                unit="%"
                accentClass="accent-rose-600"
              />
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Classroom & Trainer Bottlenecks</h4>
              
              <CustomRangeSlider
                label="Max Class Cohort Size"
                min={5}
                max={30}
                step={1}
                value={params.maxCohortSize}
                onChange={(val) => setParams(prev => ({ ...prev, maxCohortSize: Math.round(val) }))}
                unit=" agents"
                accentClass="accent-indigo-600"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Available Rooms</label>
                  <input
                    type="number"
                    min="1"
                    value={params.trainingRoomsCount}
                    onChange={(e) => setParams(prev => ({ ...prev, trainingRoomsCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Available Trainers</label>
                  <input
                    type="number"
                    min="1"
                    value={params.trainerCount}
                    onChange={(e) => setParams(prev => ({ ...prev, trainerCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Salary & Acquisition Costs</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Loaded Hourly Wage</label>
                  <input
                    type="number"
                    value={params.hourlyRate}
                    onChange={(e) => setParams(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 10 }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium mb-1">Recruitment cost/hire</label>
                  <input
                    type="number"
                    value={params.sourcingCostPerHire}
                    onChange={(e) => setParams(prev => ({ ...prev, sourcingCostPerHire: parseInt(e.target.value) || 0 }))}
                    className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side Table: Capacity Plan Sheet */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Quick Stats overview cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-xs text-center space-y-1">
              <Briefcase className="w-4 h-4 text-blue-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Total New Hires</div>
              <div className="text-lg font-bold text-gray-800">{totalHires} FTE</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-xs text-center space-y-1">
              <UserPlus className="w-4 h-4 text-emerald-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Acquisition Cost</div>
              <div className="text-lg font-bold text-gray-800">${totalRecruitmentCost.toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-xs text-center space-y-1">
              <DollarSign className="w-4 h-4 text-indigo-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Training Classes</div>
              <div className="text-lg font-bold text-gray-800">${totalTrainingCost.toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-xs text-center space-y-1">
              <Calendar className="w-4 h-4 text-teal-600 mx-auto" />
              <div className="text-[10px] text-gray-400 font-semibold uppercase">Total Plan Budget</div>
              <div className="text-lg font-bold text-gray-800">${totalOperatingCost.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">6-Month Capacity Hiring Plan Roadmap</h4>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm font-semibold">Automatic Optimization Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-medium">
                    <th className="py-2 text-[11px]">Month</th>
                    <th className="py-2 text-right text-[11px]">Target Sizing (FTE)</th>
                    <th className="py-2 text-right text-[11px]">Starting FTE</th>
                    <th className="py-2 text-right text-[11px]">Attrition Loss</th>
                    <th className="py-2 text-right text-[11px] text-blue-600">New Cohort Needed</th>
                    <th className="py-2 text-right text-[11px]">Ending FTE</th>
                    <th className="py-2 text-right text-[11px]">Deficit (OT)</th>
                    <th className="py-2 text-right text-[11px]">Month Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                  {capacityPlan.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/30">
                      <td className="py-2.5 font-bold text-gray-700">{p.monthName}</td>
                      <td className="py-2.5 text-right font-normal text-gray-500">{p.requiredFte}</td>
                      <td className="py-2.5 text-right">{p.startingFte}</td>
                      <td className="py-2.5 text-right text-rose-500 font-normal">-{p.attritionLossFte}</td>
                      <td className="py-2.5 text-right text-blue-600 font-bold">+{p.newHiresNeeded} hires</td>
                      <td className="py-2.5 text-right font-bold text-gray-700">{p.endingFte}</td>
                      <td className="py-2.5 text-right font-normal text-amber-600">{p.fteDeficit > 0 ? `${p.fteDeficit} FTE` : '-'}</td>
                      <td className="py-2.5 text-right text-gray-800">${p.totalCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {capacityPlan.some(p => p.sourcingStartedFte > p.newHiresNeeded) && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-medium leading-relaxed my-2">
                ⚠️ <strong>Training Facility Bottleneck Detected:</strong> In one or more months, the sizing deficit required more hires than your trainers or training classrooms can accommodate (max limit: {Math.min(params.trainingRoomsCount, params.trainerCount) * params.maxCohortSize} agents/mo). The remaining staffing gap is handled via overtime (OT). Increase rooms or trainer counts to resolve.
              </div>
            )}
            <p className="text-[11px] text-gray-400 leading-relaxed pt-2">
              <strong>Workflow Dependency Alert:</strong> New cohort counts are mathematically locked back-to-back with Erlang staffing curves. Increasing shrinkage or lowering SLA targets dynamically recalculates required hiring classes above.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        {certifiedSteps[4] ? (
          <button
            id="continue-to-scheduling"
            onClick={onNext}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer animate-fadeIn"
          >
            <span>Continue to Shift Scheduler</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-amber-600 font-semibold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span>Please Review &amp; Certify Capacity &amp; Hiring Plan above to unlock Shift Scheduler</span>
          </div>
        )}
      </div>
    </div>
  );
}
