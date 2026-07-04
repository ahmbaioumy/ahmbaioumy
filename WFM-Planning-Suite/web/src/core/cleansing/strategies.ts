type ImputeFn = (values: number[], anomalies: number[]) => [number[], Array<{ index: number; old: number; new: number; method: string }>]

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function detectSpikes(values: number[], z = 3): number[] {
  if (values.length < 3) return []
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length
  const stdev = Math.sqrt(variance)
  if (stdev === 0) return []
  return values.map((v, i) => (Math.abs(v - mean) > z * stdev ? i : -1)).filter((i) => i >= 0)
}

const imputeMedian: ImputeFn = (values, anomalies) => {
  const result = [...values]
  const changes: Array<{ index: number; old: number; new: number; method: string }> = []
  const clean = values.filter((_, i) => !anomalies.includes(i))
  const fill = clean.length ? median(clean) : 0
  for (const idx of anomalies) {
    changes.push({ index: idx, old: result[idx], new: fill, method: 'median' })
    result[idx] = fill
  }
  return [result, changes]
}

const imputeLinear: ImputeFn = (values, anomalies) => {
  const result = [...values]
  const changes: Array<{ index: number; old: number; new: number; method: string }> = []
  const set = new Set(anomalies)
  for (const idx of [...anomalies].sort((a, b) => a - b)) {
    let prev: number | null = null, next: number | null = null
    for (let j = idx - 1; j >= 0; j--) if (!set.has(j)) { prev = result[j]; break }
    for (let j = idx + 1; j < result.length; j++) if (!set.has(j)) { next = result[j]; break }
    const nv = prev !== null && next !== null ? (prev + next) / 2 : prev ?? next ?? 0
    changes.push({ index: idx, old: result[idx], new: nv, method: 'linear_interpolation' })
    result[idx] = nv
  }
  return [result, changes]
}

const imputeRolling: ImputeFn = (values, anomalies) => {
  const result = [...values]
  const changes: Array<{ index: number; old: number; new: number; method: string }> = []
  const set = new Set(anomalies)
  for (const idx of anomalies) {
    const neighbors = values.filter((_, j) => Math.abs(j - idx) <= 5 && !set.has(j))
    const nv = neighbors.length ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length : 0
    changes.push({ index: idx, old: result[idx], new: nv, method: 'rolling_mean' })
    result[idx] = nv
  }
  return [result, changes]
}

export const IMPUTATION_METHODS: Record<string, ImputeFn> = {
  median: imputeMedian,
  linear_interpolation: imputeLinear,
  rolling_mean: imputeRolling,
}

export function applyCleansing(values: number[], method: string, zThreshold = 3) {
  const anomalies = [...new Set(detectSpikes(values, zThreshold))]
  const fn = IMPUTATION_METHODS[method]
  if (!fn) throw new Error(`Unknown method: ${method}`)
  const [cleaned, changes] = fn(values, anomalies)
  return { cleaned, changes, anomalies }
}
