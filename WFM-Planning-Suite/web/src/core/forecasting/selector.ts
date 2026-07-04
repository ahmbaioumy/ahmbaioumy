import type { Forecast, ForecastPoint } from '../models'

function wmape(actual: number[], predicted: number[]): number {
  const denom = actual.reduce((a, v) => a + Math.abs(v), 0)
  if (denom === 0) return 0
  return (actual.reduce((a, v, i) => a + Math.abs(v - predicted[i]), 0) / denom) * 100
}

const models: Record<string, (h: number[], horizon: number) => number[]> = {
  naive: (h, n) => Array(n).fill(h[h.length - 1] ?? 0),
  moving_average: (h, n) => { const avg = h.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, h.length); return Array(n).fill(avg) },
  seasonal_naive: (h, n) => {
    const season = 7
    if (h.length < season) return models.moving_average(h, n)
    return Array.from({ length: n }, (_, i) => h[h.length - season + (i % season)])
  },
  linear_trend: (h, n) => {
    if (h.length < 2) return models.naive(h, n)
    const xs = h.map((_, i) => i)
    const nPts = h.length
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = h.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((a, x, i) => a + x * h[i], 0)
    const sumX2 = xs.reduce((a, x) => a + x * x, 0)
    const slope = (nPts * sumXY - sumX * sumY) / (nPts * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / nPts
    return Array.from({ length: n }, (_, i) => Math.max(0, slope * (h.length + i) + intercept))
  },
}

export function selectAndForecast(timestamps: Date[], volumes: number[], horizon: number): Forecast {
  if (!volumes.length) {
    return { points: [], modelName: 'none', accuracyWmape: null, fallbackUsed: true, fallbackReason: 'No historical data' }
  }

  const holdout = Math.max(1, Math.min(7, Math.floor(volumes.length / 5)))
  let modelName = 'moving_average'
  let preds: number[] = []
  let accuracyWmape: number | null = null
  let fallbackUsed = false
  let fallbackReason: string | null = null

  if (volumes.length < holdout + 2) {
    fallbackUsed = true
    fallbackReason = `Insufficient history (${volumes.length} points) for holdout validation`
    preds = models.moving_average(volumes, horizon)
  } else {
    const train = volumes.slice(0, -holdout)
    const test = volumes.slice(-holdout)
    let best = Infinity
    for (const [name, fn] of Object.entries(models)) {
      const holdoutPreds = fn(train, holdout)
      const score = wmape(test, holdoutPreds)
      if (score < best) { best = score; modelName = name; accuracyWmape = score }
    }
    preds = models[modelName](volumes, horizon)
  }

  const delta = timestamps.length >= 2 ? timestamps[1].getTime() - timestamps[0].getTime() : 86400000
  const lastTs = timestamps[timestamps.length - 1]
  const points: ForecastPoint[] = preds.map((volume, i) => ({
    timestamp: new Date(lastTs.getTime() + delta * (i + 1)),
    volume: Math.max(0, volume),
  }))

  return { points, modelName, accuracyWmape, fallbackUsed, fallbackReason }
}
