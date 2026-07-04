import type { ErlangModel } from '../models'

export interface ErlangKPIs {
  agents: number
  trafficErlangs: number
  slaPct: number
  asaSeconds: number
  abandonmentPct: number
  occupancyPct: number
  model: ErlangModel
}

export function erlangB(agents: number, traffic: number): number {
  if (agents <= 0) return 1
  if (traffic <= 0) return 0
  let invB = 1
  for (let k = 1; k <= agents; k++) invB = 1 + (k / traffic) * invB
  return 1 / invB
}

export function erlangC(agents: number, traffic: number): number {
  if (agents <= 0) return 1
  if (traffic <= 0) return 0
  if (agents <= traffic) return 1
  const b = erlangB(agents, traffic)
  const denom = agents - traffic * (1 - b)
  if (denom <= 0) return 1
  return (agents * b) / denom
}

export function slaErlangC(agents: number, traffic: number, aht: number, slaTime: number): number {
  if (traffic <= 0 || agents <= 0) return 100
  if (agents <= traffic) return 0
  const c = erlangC(agents, traffic)
  if (aht <= 0) return 0
  const exp = -(agents - traffic) * (slaTime / aht)
  return Math.max(0, Math.min(100, (1 - c * Math.exp(exp)) * 100))
}

export function asaErlangC(agents: number, traffic: number, aht: number): number {
  if (traffic <= 0 || agents <= 0) return 0
  if (agents <= traffic) return Infinity
  const c = erlangC(agents, traffic)
  return (c * aht) / (agents - traffic)
}

export function abandonmentErlangA(agents: number, traffic: number, aht: number, patience: number): number {
  if (traffic <= 0 || patience <= 0) return 0
  if (agents <= traffic) return 100
  const c = erlangC(agents, traffic)
  if (aht <= 0) return 0
  const factor = (agents - traffic) / aht
  if (factor <= 0) return 0
  return Math.max(0, Math.min(100, c * (factor / (factor + 1 / patience)) * 100))
}

export function slaErlangA(agents: number, traffic: number, aht: number, slaTime: number, patience: number): number {
  const abandon = abandonmentErlangA(agents, traffic, aht, patience) / 100
  const base = slaErlangC(agents, traffic, aht, slaTime) / 100
  return Math.max(0, Math.min(100, base * (1 - abandon * 0.5) * 100))
}

function occupancy(traffic: number, agents: number): number {
  if (agents <= 0) return 100
  return Math.max(0, Math.min(100, (traffic / agents) * 100))
}

export function kpisForAgents(
  agents: number, volume: number, intervalSec: number, aht: number,
  model: ErlangModel, slaTime = 20, patience = 120,
): ErlangKPIs {
  const traffic = volume > 0 ? (volume * aht) / intervalSec : 0
  const n = Math.max(1, agents)

  if (model === 'erlang_b') {
    const block = erlangB(n, traffic) * 100
    return { agents: n, trafficErlangs: traffic, slaPct: Math.max(0, 100 - block), asaSeconds: 0, abandonmentPct: block, occupancyPct: occupancy(traffic, n), model }
  }
  if (model === 'erlang_c') {
    return { agents: n, trafficErlangs: traffic, slaPct: slaErlangC(n, traffic, aht, slaTime), asaSeconds: asaErlangC(n, traffic, aht), abandonmentPct: 0, occupancyPct: occupancy(traffic, n), model }
  }
  return { agents: n, trafficErlangs: traffic, slaPct: slaErlangA(n, traffic, aht, slaTime, patience), asaSeconds: asaErlangC(n, traffic, aht), abandonmentPct: abandonmentErlangA(n, traffic, aht, patience), occupancyPct: occupancy(traffic, n), model }
}

export function requiredAgents(
  volume: number, intervalSec: number, aht: number, model: ErlangModel,
  slaTarget = 80, slaTime = 20, patience = 120, maxAgents = 500,
): [number, ErlangKPIs] {
  if (volume <= 0) return [0, kpisForAgents(0, 0, intervalSec, aht, model, slaTime, patience)]
  const traffic = (volume * aht) / intervalSec
  const start = Math.max(1, Math.ceil(traffic))
  for (let n = start; n <= maxAgents; n++) {
    const kpi = kpisForAgents(n, volume, intervalSec, aht, model, slaTime, patience)
    if (model === 'erlang_b') {
      if (kpi.abandonmentPct <= 100 - slaTarget) return [n, kpi]
    } else if (kpi.slaPct >= slaTarget) return [n, kpi]
  }
  return [maxAgents, kpisForAgents(maxAgents, volume, intervalSec, aht, model, slaTime, patience)]
}
