import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  Rating,
  Stack,
  TextField,
  Typography,
  Chip
} from '@mui/material'

type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
type PrayerStatus = 'pending' | 'completed' | 'missed'

type PrayerSettings = {
  username: string
  mode: 'auto' | 'manual'
  latitude: number | null
  longitude: number | null
  tz_offset_min: number
  calc_method: 'MWL' | 'ISNA' | 'Egypt' | 'Makkah' | 'Karachi'
  madhab: 'shafi' | 'hanafi'
  reminder_interval_min: number
  critical_before_next_min: number
  allow_late_mark: boolean
}

type PrayerLog = {
  prayer: PrayerName
  scheduled_at: string
  next_prayer_at?: string | null
  status: PrayerStatus
  bucket?: string | null
  points: number
  marked_at?: string | null
}

type TodayPayload = {
  schedule: {
    day: string
    source: 'auto' | 'manual'
    fajr_at: string
    dhuhr_at: string
    asr_at: string
    maghrib_at: string
    isha_at: string
  }
  logs: PrayerLog[]
  points_today: number
  rating_today: number
}

type IbadahType = 'azkar_am' | 'azkar_pm' | 'quran_page' | 'dua_10m' | 'sadaqa' | 'night_prayer'

const IBADAH_LABELS: Record<IbadahType, string> = {
  azkar_am: 'أذكار الصباح',
  azkar_pm: 'أذكار المساء',
  quran_page: 'صفحة قرآن',
  dua_10m: 'دعاء 10 دقائق',
  sadaqa: 'صدقة',
  night_prayer: 'قيام / تهجد / تراويح'
}

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr (الفجر)',
  dhuhr: 'Dhuhr (الظهر)',
  asr: 'Asr (العصر)',
  maghrib: 'Maghrib (المغرب)',
  isha: 'Isha (العشاء)'
}

type IbadahSettings = { username: string; enabled_types: IbadahType[] }

type StatsPayload = { points_mtd: number; days: { day: string; points: number }[] }

function fmtLocalTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function SimpleLineChart({ data }: { data: { day: string; points: number }[] }) {
  const w = 600
  const h = 160
  const pad = 24
  const maxY = Math.max(10, ...data.map(d => d.points))

  const points = data.map((d, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
    const y = h - pad - (d.points * (h - pad * 2)) / maxY
    return { x, y }
  })

  const dAttr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        <path d={dAttr} fill="none" stroke="#1976d2" strokeWidth="2" />
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#1976d2" />
        ))}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#bbb" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#bbb" strokeWidth="1" />
      </svg>
    </Box>
  )
}

export default function PrayerDashboard() {
  const [settings, setSettings] = useState<PrayerSettings | null>(null)
  const [today, setToday] = useState<TodayPayload | null>(null)
  const [ibadah, setIbadah] = useState<IbadahSettings | null>(null)
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [manualTimes, setManualTimes] = useState({
    fajr_local: '05:00',
    dhuhr_local: '12:00',
    asr_local: '15:30',
    maghrib_local: '18:00',
    isha_local: '19:30'
  })

  const lastNotifRef = useRef<Record<string, number>>({})

  const apiBase = import.meta.env.VITE_API_BASE || ''

  const refresh = useCallback(async () => {
    const [s, t, i, st] = await Promise.all([
      axios.get(`${apiBase}/prayer/settings`),
      axios.get(`${apiBase}/prayer/today`),
      axios.get(`${apiBase}/prayer/ibadah/settings`),
      axios.get(`${apiBase}/prayer/stats?days=30`)
    ])
    setSettings(s.data)
    setToday(t.data)
    setIbadah(i.data)
    setStats(st.data)
  }, [apiBase])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requestNotifications = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    await Notification.requestPermission()
  }

  const notify = (title: string, body: string) => {
    const key = `${title}:${body}`
    const now = Date.now()
    const last = lastNotifRef.current[key] || 0
    if (now - last < 60_000) return // de-dupe 1m
    lastNotifRef.current[key] = now

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
      return
    }
    window.dispatchEvent(new CustomEvent('nps-alert', { detail: `${title} - ${body}` }))
  }

  const enabledIbadah = useMemo(() => new Set<IbadahType>(ibadah?.enabled_types || []), [ibadah])

  useEffect(() => {
    if (!settings || !today) return
    const interval = window.setInterval(() => {
      const now = new Date()
      for (const l of today.logs) {
        if (l.status !== 'pending') continue
        const start = new Date(l.scheduled_at)
        const next = l.next_prayer_at ? new Date(l.next_prayer_at) : null
        if (now < start) continue

        const minsSinceStart = Math.floor((now.getTime() - start.getTime()) / 60000)
        const every = Math.max(5, settings.reminder_interval_min)
        if (minsSinceStart >= 0 && minsSinceStart % every === 0) {
          notify(`Prayer: ${PRAYER_LABELS[l.prayer]}`, `Still pending (${minsSinceStart}m). Mark complete or missed.`)
        }
        if (next) {
          const minsToNext = Math.floor((next.getTime() - now.getTime()) / 60000)
          if (minsToNext <= settings.critical_before_next_min && minsToNext >= 0) {
            notify(
              `Critical: ${PRAYER_LABELS[l.prayer]}`,
              `Next prayer in ${minsToNext}m. Mark now (complete or missed).`
            )
          }
        }
      }
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [settings, today])

  const useLocation = async () => {
    if (!navigator.geolocation) return
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 })
    )
    const tzOffset = new Date().getTimezoneOffset()
    const payload = {
      mode: 'auto',
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      tz_offset_min: tzOffset,
      calc_method: settings?.calc_method || 'MWL',
      madhab: settings?.madhab || 'shafi',
      reminder_interval_min: settings?.reminder_interval_min || 15,
      critical_before_next_min: settings?.critical_before_next_min || 10,
      allow_late_mark: settings?.allow_late_mark ?? true
    }
    await axios.put(`${apiBase}/prayer/settings`, payload)
    await refresh()
  }

  const saveSettings = async (patch: Partial<PrayerSettings>) => {
    if (!settings) return
    await axios.put(`${apiBase}/prayer/settings`, { ...settings, ...patch })
    await refresh()
  }

  const markPrayer = async (prayer: PrayerName, status: 'completed' | 'missed') => {
    if (!today) return
    await axios.post(`${apiBase}/prayer/mark/${today.schedule.day}/${prayer}`, { status })
    await refresh()
  }

  const saveManualSchedule = async () => {
    if (!today) return
    await axios.put(`${apiBase}/prayer/manual/${today.schedule.day}`, manualTimes)
    await refresh()
  }

  const toggleIbadah = async (t: IbadahType, enabled: boolean) => {
    const next = new Set<IbadahType>(ibadah?.enabled_types || [])
    if (enabled) next.add(t)
    else next.delete(t)
    await axios.put(`${apiBase}/prayer/ibadah/settings`, { enabled_types: Array.from(next) })
    await refresh()
  }

  const markIbadah = async (t: IbadahType, status: 'completed' | 'skipped') => {
    if (!today) return
    await axios.post(`${apiBase}/prayer/ibadah/mark/${today.schedule.day}/${t}`, { status })
    await refresh()
  }

  if (!settings || !today || !ibadah || !stats) return <Typography>Loading...</Typography>

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Box>
              <Typography variant="h6">Today</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`Points: ${today.points_today}`} color="primary" />
                <Rating value={today.rating_today} precision={0.1} readOnly />
                <Chip label={`MTD: ${stats.points_mtd}`} variant="outlined" />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={requestNotifications}>Enable Notifications</Button>
              <Button variant="contained" onClick={useLocation}>Use My Location</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6">Prayers</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                {today.logs.map(l => (
                  <Box key={l.prayer} sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                      <Box>
                        <Typography variant="subtitle1">{PRAYER_LABELS[l.prayer]}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {fmtLocalTime(l.scheduled_at)} {l.next_prayer_at ? `→ next ${fmtLocalTime(l.next_prayer_at)}` : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={`${l.status}${l.bucket ? ` (${l.bucket})` : ''}`} color={l.status === 'completed' ? 'success' : l.status === 'missed' ? 'error' : 'default'} />
                        <Chip label={`+${l.points}`} variant="outlined" />
                        <Button size="small" variant="contained" onClick={() => markPrayer(l.prayer, 'completed')}>Done</Button>
                        <Button size="small" variant="outlined" onClick={() => markPrayer(l.prayer, 'missed')}>Miss</Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1">Reminder Thresholds</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap">
                <TextField
                  label="Every (min)"
                  type="number"
                  size="small"
                  value={settings.reminder_interval_min}
                  onChange={e => saveSettings({ reminder_interval_min: Number(e.target.value || 15) })}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="Critical before next (min)"
                  type="number"
                  size="small"
                  value={settings.critical_before_next_min}
                  onChange={e => saveSettings({ critical_before_next_min: Number(e.target.value || 10) })}
                  sx={{ width: 220 }}
                />
                <FormControlLabel
                  control={<Checkbox checked={settings.allow_late_mark} onChange={e => saveSettings({ allow_late_mark: e.target.checked })} />}
                  label="Allow late marking"
                />
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1">Manual Schedule (optional)</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap">
                {(['fajr_local','dhuhr_local','asr_local','maghrib_local','isha_local'] as const).map(k => (
                  <TextField
                    key={k}
                    label={k.replace('_local','').toUpperCase()}
                    size="small"
                    value={(manualTimes as any)[k]}
                    onChange={e => setManualTimes(prev => ({ ...prev, [k]: e.target.value }))}
                    sx={{ width: 140 }}
                  />
                ))}
                <Button variant="outlined" onClick={saveManualSchedule}>Save Manual</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6">طاعة / عبادة (Extras)</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                {(Object.keys(IBADAH_LABELS) as IbadahType[]).map(t => (
                  <Box key={t} sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                      <FormControlLabel
                        control={<Checkbox checked={enabledIbadah.has(t)} onChange={e => toggleIbadah(t, e.target.checked)} />}
                        label={IBADAH_LABELS[t]}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" disabled={!enabledIbadah.has(t)} onClick={() => markIbadah(t, 'completed')}>Done</Button>
                        <Button size="small" variant="outlined" disabled={!enabledIbadah.has(t)} onClick={() => markIbadah(t, 'skipped')}>Skip</Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6">Progress (last 30 days)</Typography>
          <Divider sx={{ my: 1 }} />
          <SimpleLineChart data={stats.days} />
        </CardContent>
      </Card>
    </Stack>
  )
}

