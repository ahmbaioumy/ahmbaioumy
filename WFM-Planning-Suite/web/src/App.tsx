import { useCallback, useEffect, useState } from 'react'
import type { PipelineState } from './core/models'
import { defaultProfile } from './core/models'
import { StepNav } from './components/StepNav'
import { UploadStage } from './stages/UploadStage'
import { ProfileStage } from './stages/ProfileStage'
import { CleanseStage } from './stages/CleanseStage'
import { ForecastStage } from './stages/ForecastStage'
import { SizeStage } from './stages/SizeStage'
import { ScheduleStage } from './stages/ScheduleStage'
import { SimulateStage } from './stages/SimulateStage'
import { ReportStage } from './stages/ReportStage'
import './App.css'

const STAGES = ['Upload', 'Profile', 'Cleanse', 'Forecast', 'Size', 'Schedule', 'Simulate', 'Report'] as const
const STORAGE_KEY = 'wfm-pipeline-state-v1'

const stageComponents = [
  UploadStage, ProfileStage, CleanseStage, ForecastStage,
  SizeStage, ScheduleStage, SimulateStage, ReportStage,
]

function loadState(): PipelineState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...parsed, profile: { ...defaultProfile(), ...parsed.profile } }
    }
  } catch { /* ignore */ }
  return { upload: null, profile: defaultProfile(), cleansed: null, forecast: null, sizing: null, schedule: null, simulation: null, headcount: 50 }
}

export default function App() {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [state, setState] = useState<PipelineState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      profile: state.profile,
      headcount: state.headcount,
    }))
  }, [state.profile, state.headcount])

  const update = useCallback((patch: Partial<PipelineState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const goNext = () => {
    setCompleted((c) => new Set(c).add(step))
    if (step < STAGES.length - 1) setStep(step + 1)
  }

  const Stage = stageComponents[step]

  return (
    <div className="app">
      <header className="app-header">
        <h1>WFM Planning Suite</h1>
        <p className="subtitle">Upload → Cleanse → Forecast → Size → Schedule → Simulate → Report</p>
        <p className="badge-offline">Runs in your browser — data never leaves your device</p>
      </header>
      <div className="app-body">
        <StepNav stages={STAGES} current={step} completed={completed} onSelect={setStep} />
        <main className="stage-panel">
          <Stage state={state} update={update} onNext={goNext} />
        </main>
      </div>
    </div>
  )
}
