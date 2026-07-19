export interface HistoricalRow {
  id: string;
  timestamp: string; // ISO or date string
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  interval: string;  // e.g. "08:00", "08:30"
  volume: number;
  aht: number;       // in seconds
  channel: string;   // voice, chat, email, social, complaint, outbound
  isAnomaly?: boolean;
  anomalyReason?: string;
  cleansedVolume?: number;
  cleansedAht?: number;
}

export type CleansingMethod = 'zscore' | 'iqr' | 'moving_median' | 'none';

export type ImputationMethod = 'mean' | 'median' | 'zero' | 'forward_fill' | 'none';

export type ForecastingModel = 'average' | 'moving_average' | 'trend' | 'seasonal_hw' | 'prophet_style' | 'ensemble_blend' | 'sarima_approx' | 'croston_intermittent';

export type SizingModel = 'erlang_c' | 'erlang_a' | 'erlang_b' | 'blended' | 'workload';

export interface ChannelParams {
  targetSlaPercent: number;    // e.g. 80 (for 80%)
  targetSlaSeconds: number;    // e.g. 20 (for 20s)
  targetAsaSeconds: number;    // e.g. 30
  targetAnswerPercent: number;  // e.g. 95 (for 95%)
  occupancyTarget: number;      // e.g. 85 (for 85%)
  utilizationTarget: number;    // e.g. 80 (for 80%)
  shrinkage: number;            // e.g. 30 (for 30% total shrinkage)
  adherence: number;            // e.g. 90 (for 90%)
  ahtTarget: number;            // default AHT override if needed, or derived from data
}

export interface ProfileParams {
  channels: Record<string, ChannelParams>;
  agentProductiveDailyHrs: number;
  agentProductiveWeeklyHrs: number;
  agentProductiveMonthlyHrs: number;
  businessWindowStart: string;  // e.g. "08:00"
  businessWindowEnd: string;    // e.g. "20:00"
  businessDays: number[];       // [1, 2, 3, 4, 5] (1=Mon, 7=Sun)
}

export interface ForecastRow {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  interval: string;
  volume: number;
  aht: number;
  channel: string;
}

export interface SizingResultRow {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  interval: string;
  channel: string;
  volume: number;
  aht: number;
  workloadHrs: number;
  rawRequiredAgents: number; // raw Erlang/Workload output
  occupancyAdjusted: number; // adjusted for maximum occupancy target
  shrinkageAdjusted: number; // rawRequired / (1 - shrinkage/100)
  finalRequiredAgents: number; // final staffing needed after adherence
}

export interface CapacityPlanParams {
  sourcingDurationWeeks: number;
  trainingDurationWeeks: number;
  nestingDurationWeeks: number;
  throughputPercent: number; // percentage making it out of training
  attritionPercentMonthly: number; // monthly attrition rate
  hourlyRate: number; // base wage per hour for fully loaded agent cost
  overtimeRateMultiplier: number; // e.g. 1.5
  sourcingCostPerHire: number;
  trainingCostPerClass: number;
  maxCohortSize: number;       // e.g. 15 agents max per class
  trainingRoomsCount: number;  // e.g. 2 rooms available
  trainerCount: number;        // e.g. 2 trainers available
}

export interface CapacityMonthlyPlan {
  monthName: string;
  monthIndex: number;
  requiredFte: number;
  startingFte: number;
  attritionLossFte: number;
  newHiresNeeded: number;
  sourcingStartedFte: number;
  trainingCohortFte: number;
  nestingCohortFte: number;
  endingFte: number;
  fteDeficit: number;
  recruitmentCost: number;
  trainingCost: number;
  operationalCost: number;
  totalCost: number;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "16:30" (including unpaid breaks, productive hours are 8)
  productiveHrs: number;
  daysOfWeek: number[]; // e.g. [1,2,3,4,5]
  type: 'FT' | 'PT';
}

export interface ScheduleAssignment {
  id: string;
  shiftId: string;
  shiftName: string;
  channel: string;
  agentCount: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface IntervalScheduleCoverage {
  time: string;
  required: number;
  scheduled: number;
  variance: number;
}

export interface SimulationResult {
  intervalCoverages: Array<{
    time: string;
    volume: number;
    aht: number;
    agentsAvailable: number;
    simulatedSla: number;
    simulatedAsa: number;
    abandonRate: number;
    occupancy: number;
  }>;
  overallSla: number;
  overallAsa: number;
  overallAbandonRate: number;
  overallOccupancy: number;
  totalCalls: number;
  handledCalls: number;
  abandonedCalls: number;
}

export interface CostAnalysisReport {
  totalSourcingCost: number;
  totalTrainingCost: number;
  totalBaseSalaries: number;
  totalOvertimeCosts: number;
  grandTotalCost: number;
  costPerContact: number;
  costPerAgentHour: number;
  slachievmentRate: number; // % of intervals meeting SLA
  utilizationEfficiency: number; // average capacity vs requirements
}
