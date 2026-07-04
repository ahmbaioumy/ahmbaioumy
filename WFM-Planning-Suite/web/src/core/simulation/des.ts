import type { SimulationResult, SizingResult } from '../models'

function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

export function runSimulation(
  sizing: SizingResult, aht: number, patience: number, agents: number, warmup = 5, seed = 42,
): SimulationResult {
  const rand = seededRandom(seed)
  const intervalSec = sizing.profile.intervalMinutes * 60
  let answered = 0, abandoned = 0, withinSla = 0, totalWait = 0, intervalsSimulated = 0

  for (let idx = 0; idx < sizing.rows.length; idx++) {
    if (idx < warmup) continue
    intervalsSimulated++
    const volume = Math.round(sizing.rows[idx].volume)
    if (volume <= 0) continue

    const calls = Array.from({ length: volume }, () => ({
      arrival: rand() * intervalSec,
      patience: patience > 0 ? -Math.log(1 - rand()) * patience : Infinity,
      service: aht > 0 ? -Math.log(1 - rand()) * aht : 1,
    })).sort((a, b) => a.arrival - b.arrival)

    const agentFree = Array(Math.max(1, agents)).fill(0)
    for (const call of calls) {
      let best = 0
      for (let i = 1; i < agentFree.length; i++) if (agentFree[i] < agentFree[best]) best = i
      let wait = 0
      if (agentFree[best] > call.arrival) {
        wait = agentFree[best] - call.arrival
        if (wait > call.patience) { abandoned++; continue }
      }
      const start = Math.max(call.arrival, agentFree[best])
      totalWait += wait
      agentFree[best] = start + call.service
      answered++
      if (wait <= sizing.profile.slaTimeSeconds) withinSla++
    }
  }

  const total = answered + abandoned
  return {
    slaPct: total > 0 ? (withinSla / total) * 100 : 100,
    asaSeconds: answered > 0 ? totalWait / answered : 0,
    abandonmentPct: total > 0 ? (abandoned / total) * 100 : 0,
    intervalsSimulated,
    crossCheckPassed: null,
    crossCheckNotes: null,
  }
}

export function crossValidate(sizing: SizingResult, sim: SimulationResult, tolerance = 15): SimulationResult {
  if (!sizing.rows.length) {
    return { ...sim, crossCheckPassed: true, crossCheckNotes: 'No sizing rows to compare' }
  }
  const avgSla = sizing.rows.reduce((a, r) => a + r.slaPct, 0) / sizing.rows.length
  const delta = Math.abs(avgSla - sim.slaPct)
  return {
    ...sim,
    crossCheckPassed: delta <= tolerance,
    crossCheckNotes: `Analytic avg SLA ${avgSla.toFixed(1)}% vs simulation ${sim.slaPct.toFixed(1)}% (delta ${delta.toFixed(1)}%)`,
  }
}
