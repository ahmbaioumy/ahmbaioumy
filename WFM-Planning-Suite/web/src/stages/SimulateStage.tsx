import { useEffect, useState } from 'react'
import { crossValidate, runSimulation } from '../core/simulation/des'
import type { SimulationResult } from '../core/models'
import type { StageProps } from './types'

export function SimulateStage({ state, update, onNext }: StageProps) {
  const [sim, setSim] = useState<SimulationResult | null>(state.simulation)

  useEffect(() => {
    if (!state.sizing) return
    const agents = Math.min(state.headcount, Math.max(...state.sizing.rows.map((r) => r.agentsRequired), 1))
    const raw = runSimulation(state.sizing, state.profile.ahtSeconds, state.profile.patienceSeconds, agents)
    const result = crossValidate(state.sizing, raw)
    setSim(result)
    update({ simulation: result })
  }, [state.sizing, state.profile, state.headcount])

  return (
    <div className="stage">
      <h2>Simulation Cross-Check</h2>
      <div className="card">
        <p>Discrete-event simulation validates analytic Erlang sizing independently.</p>
        {sim && (
          <>
            <p><strong>SLA:</strong> {sim.slaPct.toFixed(1)}%</p>
            <p><strong>ASA:</strong> {sim.asaSeconds.toFixed(1)} sec</p>
            <p><strong>Abandonment:</strong> {sim.abandonmentPct.toFixed(1)}%</p>
            <p><strong>Intervals simulated:</strong> {sim.intervalsSimulated} (warm-up excluded)</p>
            <p><strong>Cross-check:</strong> {sim.crossCheckPassed ? '✓ Passed' : '⚠ Review'}</p>
            <p style={{ fontSize: '0.85rem', color: '#666' }}>{sim.crossCheckNotes}</p>
          </>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!sim} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
