import { useEffect, useState } from 'react'
import { IMPUTATION_METHODS, applyCleansing } from '../core/cleansing/strategies'
import type { CleansedSeries } from '../core/models'
import type { StageProps } from './types'

export function CleanseStage({ state, update, onNext }: StageProps) {
  const [method, setMethod] = useState('median')
  const [cleansed, setCleansed] = useState<CleansedSeries | null>(state.cleansed)

  useEffect(() => {
    if (!state.upload) return
    const volumes = state.upload.rows.map((r) => r.volume)
    const { cleaned, changes } = applyCleansing(volumes, method)
    const rows = state.upload.rows.map((r, i) => ({ ...r, volume: cleaned[i] }))
    const result = { rows, methodApplied: method, changes }
    setCleansed(result)
    update({ cleansed: result })
  }, [state.upload, method])

  return (
    <div className="stage">
      <h2>Data Cleansing</h2>
      <div className="card">
        <div className="form-field">
          <label>Imputation Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.keys(IMPUTATION_METHODS).map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        {cleansed && cleansed.changes.length > 0 ? (
          <table className="data-table" style={{ marginTop: '1rem' }}>
            <thead><tr><th>Row</th><th>Old</th><th>New</th><th>Method</th></tr></thead>
            <tbody>
              {cleansed.changes.map((c, i) => (
                <tr key={i}>
                  <td>{c.index}</td><td>{c.old.toFixed(1)}</td><td>{c.new.toFixed(1)}</td><td>{c.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ marginTop: '1rem', color: '#666' }}>No anomalies detected.</p>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!cleansed} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
