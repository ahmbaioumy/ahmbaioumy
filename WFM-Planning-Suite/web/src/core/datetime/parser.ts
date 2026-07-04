export type DateOrder = 'DMY' | 'MDY' | 'YMD'

const FORMATS: Record<DateOrder, string[]> = {
  DMY: ['DD/MM/YYYY HH:mm', 'DD-MM-YYYY HH:mm', 'DD/MM/YYYY', 'DD-MM-YYYY'],
  MDY: ['MM/DD/YYYY HH:mm', 'MM-DD-YYYY HH:mm', 'MM/DD/YYYY', 'MM-DD-YYYY'],
  YMD: ['YYYY-MM-DD HH:mm', 'YYYY/MM/DD HH:mm', 'YYYY-MM-DD', 'YYYY/MM/DD'],
}

function hasUnambiguousDay(value: string): boolean {
  for (const sep of ['/', '-']) {
    const parts = value.split(sep)
    if (parts.length >= 2) {
      const first = parseInt(parts[0], 10)
      const second = parseInt(parts[1], 10)
      if (!isNaN(first) && !isNaN(second) && (first > 12 || second > 12)) return true
    }
  }
  return false
}

export function resolveDateFormat(values: string[], defaultOrder: DateOrder = 'DMY'): [DateOrder, string] {
  let dmy = 0, mdy = 0, ymd = 0
  for (const value of values) {
    const text = value.trim()
    if (!text) continue
    if (/^\d{4}/.test(text)) { ymd += 2; continue }
    if (!hasUnambiguousDay(text)) continue
    for (const sep of ['/', '-']) {
      const parts = text.split(sep)
      if (parts.length < 2) continue
      const first = parseInt(parts[0], 10)
      const second = parseInt(parts[1], 10)
      if (isNaN(first) || isNaN(second)) continue
      if (first > 12) dmy++
      if (second > 12) mdy++
    }
  }
  let order: DateOrder = defaultOrder
  if (ymd > Math.max(dmy, mdy)) order = 'YMD'
  else if (dmy > mdy) order = 'DMY'
  else if (mdy > dmy) order = 'MDY'
  return [order, FORMATS[order][0]]
}

function parseWithOrder(text: string, order: DateOrder): Date {
  const trimmed = text.trim()
  const patterns: Array<{ re: RegExp; fn: (m: RegExpMatchArray) => Date }> = []

  if (order === 'DMY') {
    patterns.push({
      re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/,
      fn: (m) => new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]),
    })
    patterns.push({
      re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      fn: (m) => new Date(+m[3], +m[2] - 1, +m[1]),
    })
  } else if (order === 'MDY') {
    patterns.push({
      re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/,
      fn: (m) => new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]),
    })
    patterns.push({
      re: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      fn: (m) => new Date(+m[3], +m[1] - 1, +m[2]),
    })
  } else {
    patterns.push({
      re: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})$/,
      fn: (m) => new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]),
    })
    patterns.push({
      re: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      fn: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
    })
  }

  for (const { re, fn } of patterns) {
    const m = trimmed.match(re)
    if (m) return fn(m)
  }
  throw new Error(`Cannot parse date '${text}' with order ${order}`)
}

export function parseSeries(values: string[]): [Date[], DateOrder, string] {
  const nonEmpty = values.filter((v) => v && v.trim())
  if (!nonEmpty.length) throw new Error('No date values to parse')
  const [order, fmt] = resolveDateFormat(nonEmpty)
  const parsed = nonEmpty.map((v) => parseWithOrder(v, order))
  return [parsed, order, fmt]
}
