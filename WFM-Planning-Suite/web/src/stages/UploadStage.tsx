import { useState } from 'react'
import { parseUploadFile } from '../core/io/files'
import type { StageProps } from './types'

export function UploadStage({ state, update, onNext }: StageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const upload = await parseUploadFile(file)
      const errors = upload.issues.filter((i) => i.severity === 'error')
      if (errors.length) {
        setError(errors.map((i) => i.message).join('; '))
        return
      }
      update({ upload })
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const upload = state.upload

  return (
    <div className="stage">
      <h2>Upload Historical Data</h2>
      <p>Import CSV or Excel with timestamp and volume columns.</p>
      <div className="card">
        <label className="file-input-label">
          {loading ? 'Loading…' : 'Browse File…'}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} />
        </label>
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
          Try the sample: <a href={`${import.meta.env.BASE_URL}sample_data.csv`} download>sample_data.csv</a>
        </p>
        {error && <div className="warn-badge">{error}</div>}
        {upload && (
          <>
            <p style={{ marginTop: '1rem' }}>
              <span className="summary-stat"><strong>{upload.rows.length}</strong> rows</span>
              {upload.dateRange && (
                <span className="summary-stat">
                  {upload.dateRange[0].toLocaleDateString()} – {upload.dateRange[1].toLocaleDateString()}
                </span>
              )}
              <span className="summary-stat">Format: {upload.dateFormat}</span>
            </p>
            <table className="data-table">
              <thead><tr><th>Timestamp</th><th>Volume</th><th>AHT</th></tr></thead>
              <tbody>
                {upload.rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{r.timestamp.toLocaleString()}</td>
                    <td>{r.volume}</td>
                    <td>{r.aht ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!upload} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
