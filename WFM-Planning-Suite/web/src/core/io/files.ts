import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parseSeries } from '../datetime/parser'
import type { DataRow, RawUpload, ValidationIssue } from '../models'

const COLUMN_ALIASES: Record<string, string[]> = {
  timestamp: ['timestamp', 'datetime', 'date', 'time', 'interval'],
  volume: ['volume', 'calls', 'contacts', 'interactions', 'count'],
  aht: ['aht', 'handle_time', 'avg_handle_time', 'talk_time'],
}

function matchColumn(headers: string[], aliases: string[]): string | null {
  const lower = Object.fromEntries(headers.map((h) => [h.toLowerCase().trim(), h]))
  for (const a of aliases) if (lower[a]) return lower[a]
  return null
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const m = matchColumn(headers, aliases)
    if (m) mapping[canonical] = m
  }
  return mapping
}

export function parseUploadFile(file: File): Promise<RawUpload> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const reader = new FileReader()

    reader.onload = () => {
      try {
        let records: Record<string, string>[] = []
        if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(reader.result, { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          records = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[]
        } else {
          const parsed = Papa.parse<Record<string, string>>(reader.result as string, { header: true, skipEmptyLines: true })
          records = parsed.data
        }

        const headers = records.length ? Object.keys(records[0]) : []
        const mapping = autoMap(headers)
        const issues: ValidationIssue[] = []
        if (!mapping.timestamp) issues.push({ severity: 'error', code: 'MISSING_TIMESTAMP', message: 'No timestamp column found' })
        if (!mapping.volume) issues.push({ severity: 'error', code: 'MISSING_VOLUME', message: 'No volume column found' })

        const dateValues = records.map((r) => String(r[mapping.timestamp] ?? ''))
        let timestamps: Date[] = []
        let dateFormat = ''
        if (mapping.timestamp && dateValues.some((v) => v.trim())) {
          const [parsed, , fmt] = parseSeries(dateValues)
          timestamps = parsed
          dateFormat = fmt
        }

        const seen = new Set<number>()
        const rows: DataRow[] = records.map((rec, i) => {
          const row: DataRow = { timestamp: timestamps[i] ?? new Date(), volume: 0 }
          if (mapping.volume) {
            row.volume = parseFloat(String(rec[mapping.volume])) || 0
            if (row.volume < 0) issues.push({ severity: 'error', code: 'NEGATIVE_VOLUME', message: `Negative volume at row ${i}`, rowIndex: i })
          }
          if (mapping.aht) row.aht = parseFloat(String(rec[mapping.aht])) || 0
          const ts = row.timestamp.getTime()
          if (seen.has(ts)) issues.push({ severity: 'warning', code: 'DUPLICATE', message: `Duplicate at row ${i}`, rowIndex: i })
          seen.add(ts)
          return row
        })

        const dateRange: [Date, Date] | null = timestamps.length
          ? [new Date(Math.min(...timestamps.map((t) => t.getTime()))), new Date(Math.max(...timestamps.map((t) => t.getTime())))]
          : null

        resolve({ rows, dateFormat, issues, dateRange })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)

    if (ext === 'xlsx' || ext === 'xls') reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  })
}

export function exportReportExcel(sheets: Record<string, object[]>, filename: string) {
  const wb = XLSX.utils.book_new()
  for (const [name, data] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}
