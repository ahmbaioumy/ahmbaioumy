export type ChannelType = 'voice' | 'chat' | 'email'
export type ErlangModel = 'erlang_a' | 'erlang_b' | 'erlang_c'
export type IntervalMethod = 'historical' | 'flat_equal'

export interface Profile {
  name: string
  slaTargetPct: number
  slaTimeSeconds: number
  ahtSeconds: number
  shrinkagePct: number
  occupancyTargetPct: number
  patienceSeconds: number
  operatingHoursStart: number
  operatingHoursEnd: number
  channel: ChannelType
  erlangModel: ErlangModel
  intervalMinutes: number
}

export const defaultProfile = (): Profile => ({
  name: 'Default',
  slaTargetPct: 80,
  slaTimeSeconds: 20,
  ahtSeconds: 300,
  shrinkagePct: 30,
  occupancyTargetPct: 85,
  patienceSeconds: 120,
  operatingHoursStart: 8,
  operatingHoursEnd: 18,
  channel: 'voice',
  erlangModel: 'erlang_c',
  intervalMinutes: 30,
})

export interface DataRow {
  timestamp: Date
  volume: number
  aht?: number
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  rowIndex?: number
}

export interface RawUpload {
  rows: DataRow[]
  dateFormat: string
  issues: ValidationIssue[]
  dateRange: [Date, Date] | null
}

export interface CleansedSeries {
  rows: DataRow[]
  methodApplied: string
  changes: Array<{ index: number; old: number; new: number; method: string }>
}

export interface ForecastPoint {
  timestamp: Date
  volume: number
}

export interface Forecast {
  points: ForecastPoint[]
  modelName: string
  accuracyWmape: number | null
  fallbackUsed: boolean
  fallbackReason: string | null
}

export interface IntervalDemand {
  intervals: Array<{ timestamp: Date; volume: number }>
  intervalMethod: IntervalMethod
  approximations: string[]
}

export interface SizingRow {
  timestamp: Date
  volume: number
  agentsRequired: number
  slaPct: number
  asaSeconds: number
  abandonmentPct: number
  erlangModel: ErlangModel
}

export interface SizingResult {
  rows: SizingRow[]
  profile: Profile
  approximations: string[]
}

export interface ScheduleAssignment {
  agentId: string
  shiftStart: Date
  shiftEnd: Date
}

export interface Schedule {
  assignments: ScheduleAssignment[]
  coverageGaps: Array<{ timestamp: string; required: number; assigned: number; gap: number }>
  warnings: string[]
}

export interface SimulationResult {
  slaPct: number
  asaSeconds: number
  abandonmentPct: number
  intervalsSimulated: number
  crossCheckPassed: boolean | null
  crossCheckNotes: string | null
}

export interface PipelineState {
  upload: RawUpload | null
  profile: Profile
  cleansed: CleansedSeries | null
  forecast: Forecast | null
  sizing: SizingResult | null
  schedule: Schedule | null
  simulation: SimulationResult | null
  headcount: number
}
