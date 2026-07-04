import { useEffect, useState } from 'react'
import { selectAndForecast } from '../core/forecasting/selector'
import type { Forecast } from '../core/models'
import type { StageProps } from './types'

export function ForecastStage({ state, update, onNext }: StageProps) {
  const [horizon, setHorizon] = useState(14)
  const [forecast, setForecast] = useState<Forecast | null>(state.forecast)

  useEffect(() => {
    const rows = state.cleansed?.rows ?? state.upload?.rows
    if (!rows?.length) return
    const daily = new Map<string, number>()
    for (const r of rows) {
      const key = r.timestamp.toISOString().slice(0, 10)
      daily.set(key, (daily.get(key) ?? 0) + r.volume)
    }
    const keys = [...daily.keys()].sort()
    const timestamps = keys.map((k) => new Date(k + 'T00:00:00'))
    const volumes = keys.map((k) => daily.get(k)!)
    const result = selectAndForecast(timestamps, volumes, horizon)
    setForecast(result)
    update({ forecast: result })
  }, [state.cleansed, state.upload, horizon])

  return (
    <div className="stage">
      <h2>Forecast</h2>
      <div className="card">
        <div className="form-field" style={{ maxWidth: 200 }}>
          <label>Horizon (days)</label>
          <input type="number" min={1} max={90} value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
        </div>
        {forecast && (
          <>
            <p><strong>Model:</strong> {forecast.modelName}</p>
            <p><strong>WMAPE:</strong> {forecast.accuracyWmape?.toFixed(1) ?? 'N/A'}%</p>
            {forecast.fallbackUsed && forecast.fallbackReason && (
              <div className="approx-badge">⚠ {forecast.fallbackReason}</div>
            )}
            <table className="data-table" style={{ marginTop: '1rem' }}>
              <thead><tr><th>Date</th><th>Volume</th></tr></thead>
              <tbody>
                {forecast.points.map((p, i) => (
                  <tr key={i}><td>{p.timestamp.toLocaleDateString()}</td><td>{p.volume.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!forecast?.points.length} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
