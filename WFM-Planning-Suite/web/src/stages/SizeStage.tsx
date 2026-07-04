import { useEffect, useState } from 'react'
import { deriveIntervalPattern, sizeIntervals } from '../core/sizing/orchestrator'
import type { SizingResult } from '../core/models'
import type { StageProps } from './types'

export function SizeStage({ state, update, onNext }: StageProps) {
  const [sizing, setSizing] = useState<SizingResult | null>(state.sizing)

  useEffect(() => {
    if (!state.forecast) return
    const fps = state.forecast.points.map((p) => ({ timestamp: p.timestamp, volume: p.volume }))
    const historical = state.cleansed?.rows ?? state.upload?.rows ?? []
    const demand = deriveIntervalPattern(historical, fps, state.profile.intervalMinutes)
    const result = sizeIntervals(demand, state.profile)
    setSizing(result)
    update({ sizing: result })
  }, [state.forecast, state.cleansed, state.upload, state.profile])

  const peak = sizing?.rows.reduce((a, b) => (b.agentsRequired > a.agentsRequired ? b : a), { agentsRequired: 0 } as { agentsRequired: number })

  return (
    <div className="stage">
      <h2>Staffing (Erlang Sizing)</h2>
      <div className="card">
        {sizing?.approximations.map((a, i) => <div key={i} className="approx-badge">⚠ {a}</div>)}
        {peak && <p><strong>Peak agents required:</strong> {peak.agentsRequired}</p>}
        {sizing && (
          <table className="data-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr><th>Interval</th><th>Volume</th><th>Agents</th><th>SLA %</th><th>ASA (s)</th><th>Abandon %</th></tr>
            </thead>
            <tbody>
              {sizing.rows.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  <td>{r.timestamp.toLocaleString()}</td>
                  <td>{r.volume.toFixed(1)}</td>
                  <td>{r.agentsRequired}</td>
                  <td>{r.slaPct.toFixed(1)}</td>
                  <td>{r.asaSeconds.toFixed(1)}</td>
                  <td>{r.abandonmentPct.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!sizing} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
