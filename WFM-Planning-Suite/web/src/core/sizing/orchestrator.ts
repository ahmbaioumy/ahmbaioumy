import { requiredAgents } from '../erlang/engine'
import type { DataRow, IntervalDemand, Profile, SizingResult } from '../models'

export function deriveIntervalPattern(
  historical: DataRow[],
  forecastPoints: Array<{ timestamp: Date; volume: number }>,
  intervalMinutes = 30,
): IntervalDemand {
  const approximations: string[] = []
  let hasInterval = false
  if (historical.length > 1) {
    const deltas = historical.slice(0, -1).map((r, i) =>
      (historical[i + 1].timestamp.getTime() - r.timestamp.getTime()) / 1000
    )
    if (deltas.length && Math.min(...deltas) <= intervalMinutes * 60) hasInterval = true
  }

  const intervals: Array<{ timestamp: Date; volume: number }> = []

  if (hasInterval) {
    const totals: Record<number, number> = {}
    const counts: Record<number, number> = {}
    for (const row of historical) {
      const slot = row.timestamp.getHours() * 60 + row.timestamp.getMinutes()
      totals[slot] = (totals[slot] ?? 0) + row.volume
      counts[slot] = (counts[slot] ?? 0) + 1
    }
    const pattern: Record<number, number> = {}
    for (const k of Object.keys(totals)) {
      const ki = +k
      pattern[ki] = totals[ki] / counts[ki]
    }
    const total = Object.values(pattern).reduce((a, b) => a + b, 0) || 1
    for (const fp of forecastPoints) {
      for (const [slot, vol] of Object.entries(pattern)) {
        const s = +slot
        const t = new Date(fp.timestamp)
        t.setHours(Math.floor(s / 60), s % 60, 0, 0)
        intervals.push({ timestamp: t, volume: fp.volume * (vol / total) })
      }
    }
    return { intervals, intervalMethod: 'historical', approximations }
  }

  approximations.push('Estimated intraday pattern — no historical interval data; using flat equal distribution')
  const slotsPerDay = Math.max(1, ((18 - 8) * 60) / intervalMinutes)
  for (const fp of forecastPoints) {
    const perSlot = fp.volume / slotsPerDay
    for (let i = 0; i < slotsPerDay; i++) {
      const t = new Date(fp.timestamp)
      t.setHours(8 + Math.floor((i * intervalMinutes) / 60), (i * intervalMinutes) % 60, 0, 0)
      intervals.push({ timestamp: t, volume: perSlot })
    }
  }
  return { intervals, intervalMethod: 'flat_equal', approximations }
}

export function sizeIntervals(demand: IntervalDemand, profile: Profile): SizingResult {
  const intervalSec = profile.intervalMinutes * 60
  const rows = demand.intervals.map((item) => {
    const [agents, kpi] = requiredAgents(
      item.volume, intervalSec, profile.ahtSeconds, profile.erlangModel,
      profile.slaTargetPct, profile.slaTimeSeconds, profile.patienceSeconds,
    )
    const shrink = 1 - profile.shrinkagePct / 100
    const adjusted = shrink > 0 && agents > 0 ? Math.ceil(agents / shrink) : agents
    return {
      timestamp: item.timestamp,
      volume: item.volume,
      agentsRequired: adjusted,
      slaPct: kpi.slaPct,
      asaSeconds: kpi.asaSeconds,
      abandonmentPct: kpi.abandonmentPct,
      erlangModel: profile.erlangModel,
    }
  })
  return { rows, profile, approximations: [...demand.approximations] }
}
