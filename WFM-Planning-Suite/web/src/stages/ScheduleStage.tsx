import { useEffect, useState } from 'react'
import { buildSchedule } from '../core/scheduling/optimizer'
import type { Schedule } from '../core/models'
import type { StageProps } from './types'

export function ScheduleStage({ state, update, onNext }: StageProps) {
  const [headcount, setHeadcount] = useState(state.headcount)
  const [schedule, setSchedule] = useState<Schedule | null>(state.schedule)

  useEffect(() => {
    if (!state.sizing) return
    const result = buildSchedule(state.sizing, headcount)
    setSchedule(result)
    update({ schedule: result, headcount })
  }, [state.sizing, headcount])

  return (
    <div className="stage">
      <h2>Schedule</h2>
      <div className="card">
        <div className="form-field" style={{ maxWidth: 200 }}>
          <label>Available Headcount (agents)</label>
          <input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(+e.target.value)} />
        </div>
        {schedule?.warnings.map((w, i) => <div key={i} className="warn-badge">⚠ {w}</div>)}
        {schedule && (
          <table className="data-table" style={{ marginTop: '1rem' }}>
            <thead><tr><th>Agent</th><th>Shift Start</th><th>Shift End</th></tr></thead>
            <tbody>
              {schedule.assignments.slice(0, 30).map((a, i) => (
                <tr key={i}>
                  <td>{a.agentId}</td>
                  <td>{a.shiftStart.toLocaleString()}</td>
                  <td>{a.shiftEnd.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="stage-actions">
        <button className="btn-primary" disabled={!schedule} onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
