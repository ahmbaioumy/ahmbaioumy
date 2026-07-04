import type { Schedule, SizingResult } from '../models'

export function buildSchedule(sizing: SizingResult, availableAgents: number, shiftHours = 8): Schedule {
  const assignments: Schedule['assignments'] = []
  const coverageGaps: Schedule['coverageGaps'] = []
  const warnings: string[] = []

  if (!sizing.rows.length) return { assignments, coverageGaps, warnings: ['No sizing data'] }

  const peak = sizing.rows.reduce((a, b) => (b.agentsRequired > a.agentsRequired ? b : a))
  if (peak.agentsRequired > availableAgents) {
    warnings.push(`Peak need ${peak.agentsRequired} agents exceeds headcount ${availableAgents}`)
  }

  const seen = new Set<string>()
  for (const row of sizing.rows) {
    const dateKey = row.timestamp.toISOString().slice(0, 10)
    if (seen.has(dateKey)) continue
    seen.add(dateKey)

    const required = row.agentsRequired
    const assigned = Math.min(required, availableAgents)
    if (required > assigned) {
      coverageGaps.push({ timestamp: row.timestamp.toISOString(), required, assigned, gap: required - assigned })
    }

    const shiftStart = new Date(row.timestamp)
    shiftStart.setHours(8, 0, 0, 0)
    const shiftEnd = new Date(shiftStart.getTime() + shiftHours * 3600000)

    for (let i = 0; i < assigned; i++) {
      assignments.push({ agentId: `AGENT_${dateKey}_${String(i + 1).padStart(3, '0')}`, shiftStart, shiftEnd })
    }
  }

  if (coverageGaps.length) warnings.push(`${coverageGaps.length} interval(s) have coverage gaps`)
  return { assignments, coverageGaps, warnings }
}
