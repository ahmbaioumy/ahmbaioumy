import { exportReportExcel } from '../core/io/files'
import type { StageProps } from './types'

export function ReportStage({ state }: StageProps) {
  const sizing = state.sizing
  const forecast = state.forecast
  const schedule = state.schedule
  const sim = state.simulation

  const peakAgents = sizing ? Math.max(...sizing.rows.map((r) => r.agentsRequired), 0) : 0
  const avgSla = sizing && sizing.rows.length
    ? sizing.rows.reduce((a, r) => a + r.slaPct, 0) / sizing.rows.length
    : 0

  const handleExport = () => {
    if (!sizing) return
    exportReportExcel({
      Summary: [
        { Metric: 'Profile', Value: state.profile.name },
        { Metric: 'Peak Agents', Value: peakAgents },
        { Metric: 'Average SLA %', Value: avgSla.toFixed(1) },
        { Metric: 'Forecast Model', Value: forecast?.modelName ?? '' },
        { Metric: 'Simulated SLA %', Value: sim?.slaPct.toFixed(1) ?? '' },
      ],
      Sizing: sizing.rows.map((r) => ({
        Timestamp: r.timestamp.toISOString(),
        Volume: r.volume,
        Agents: r.agentsRequired,
        'SLA %': r.slaPct.toFixed(2),
        'ASA (sec)': r.asaSeconds.toFixed(2),
        'Abandon %': r.abandonmentPct.toFixed(2),
      })),
      Warnings: (schedule?.warnings ?? []).map((w) => ({ Warning: w })),
    }, 'wfm_report.xlsx')
  }

  return (
    <div className="stage">
      <h2>Report</h2>
      <div className="card">
        <h3>Executive Summary</h3>
        <p><strong>Profile:</strong> {state.profile.name}</p>
        <p><strong>Peak agents required:</strong> {peakAgents} FTE</p>
        <p><strong>Average SLA:</strong> {avgSla.toFixed(1)}%</p>
        <p><strong>Forecast model:</strong> {forecast?.modelName ?? '—'}</p>
        {forecast?.accuracyWmape != null && (
          <p><strong>Forecast WMAPE:</strong> {forecast.accuracyWmape.toFixed(1)}%</p>
        )}
        {sim && (
          <p><strong>Simulation cross-check:</strong> {sim.crossCheckPassed ? 'Passed' : 'Review needed'}</p>
        )}
        {schedule?.warnings.map((w, i) => <div key={i} className="warn-badge">⚠ {w}</div>)}
        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn-primary" onClick={handleExport} disabled={!sizing}>
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  )
}
