import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { EmojiEvents, LocationOn, Refresh } from '@mui/icons-material'
import axios from 'axios'
import SimpleLineChart from './SimpleLineChart'

type PrayerSettings = {
  method: 'auto' | 'manual'
  latitude: number | null
  longitude: number | null
  timezone_offset_minutes: number
  reminder_interval_minutes: number
  critical_before_next_minutes: number
  asr_shadow_factor: number
  fajr_angle: number
  isha_angle: number
  manual_times?: {
    fajr: string
    dhuhr: string
    asr: string
    maghrib: string
    isha: string
  } | null
}

type PrayerEntry = {
  prayer_name: string
  scheduled_at: string
  completed_at?: string | null
  status: string
  bucket?: string | null
}

type PrayerScheduleResponse = {
  date: string
  timezone_offset_minutes: number
  schedule: PrayerEntry[]
}

type DevotionStatus = {
  key: string
  label: string
  completed: boolean
  completed_at?: string | null
}

type PrayerSummary = {
  date: string
  daily_score: number
  mtd_score: number
  counts: Record<string, number>
  weekly: { date: string; score: number }[]
  monthly: { date: string; score: number }[]
}

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}
const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

const BUCKET_LABELS: Record<string, string> = {
  first_hour: 'First hour',
  second_hour: 'Second hour',
  third_hour: 'Third hour',
  after_time: 'After 3 hours',
  with_next: 'With next prayer',
  missed: 'Missed',
}

const localDateString = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 10)
}

const toLocalIso = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 19)
}

const addDays = (dateStr: string, days: number) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

const formatTime = (value: string) => {
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const PrayerDashboard: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_BASE || ''
  const [settings, setSettings] = useState<PrayerSettings | null>(null)
  const [schedule, setSchedule] = useState<PrayerEntry[]>([])
  const [tomorrowSchedule, setTomorrowSchedule] = useState<PrayerEntry[]>([])
  const [devotions, setDevotions] = useState<DevotionStatus[]>([])
  const [summary, setSummary] = useState<PrayerSummary | null>(null)
  const [date, setDate] = useState(localDateString())
  const [loading, setLoading] = useState(false)
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'info',
  })
  const [bucketOverrides, setBucketOverrides] = useState<Record<string, string>>({})
  const remindersSent = useRef<Set<string>>(new Set())

  const showSnack = (message: string, severity: 'info' | 'success' | 'warning' | 'error') => {
    setSnack({ open: true, message, severity })
  }

  const fetchSettings = async () => {
    const res = await axios.get<PrayerSettings>(`${apiBase}/prayer/settings`)
    const data = res.data
    setSettings({
      ...data,
      manual_times: data.manual_times || {
        fajr: '05:00',
        dhuhr: '12:30',
        asr: '15:30',
        maghrib: '18:00',
        isha: '19:30',
      },
    })
  }

  const fetchSchedule = async (targetDate: string) => {
    const res = await axios.get<PrayerScheduleResponse>(`${apiBase}/prayer/schedule`, {
      params: { date: targetDate },
    })
    setSchedule(res.data.schedule)
  }

  const fetchTomorrowSchedule = async (targetDate: string) => {
    const res = await axios.get<PrayerScheduleResponse>(`${apiBase}/prayer/schedule`, {
      params: { date: addDays(targetDate, 1) },
    })
    setTomorrowSchedule(res.data.schedule)
  }

  const fetchDevotions = async (targetDate: string) => {
    const res = await axios.get<DevotionStatus[]>(`${apiBase}/prayer/devotions`, {
      params: { date: targetDate },
    })
    setDevotions(res.data)
  }

  const fetchSummary = async (targetDate: string) => {
    const res = await axios.get<PrayerSummary>(`${apiBase}/prayer/summary`, {
      params: { date: targetDate },
    })
    setSummary(res.data)
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchSettings(), fetchSchedule(date), fetchTomorrowSchedule(date), fetchDevotions(date), fetchSummary(date)])
    } catch (error) {
      showSnack('Failed to load prayer dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
  }, [date])

  const handleLocation = () => {
    if (!navigator.geolocation) {
      showSnack('Geolocation not supported on this device', 'warning')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const timezoneOffsetMinutes = -new Date().getTimezoneOffset()
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timezone_offset_minutes: timezoneOffsetMinutes,
              }
            : prev
        )
        showSnack('Location updated', 'success')
      },
      () => {
        showSnack('Unable to read your location', 'error')
      }
    )
  }

  const saveSettings = async () => {
    if (!settings) return
    try {
      await axios.put(`${apiBase}/prayer/settings`, {
        method: settings.method,
        latitude: settings.latitude,
        longitude: settings.longitude,
        timezone_offset_minutes: settings.timezone_offset_minutes,
        reminder_interval_minutes: settings.reminder_interval_minutes,
        critical_before_next_minutes: settings.critical_before_next_minutes,
        asr_shadow_factor: settings.asr_shadow_factor,
        fajr_angle: settings.fajr_angle,
        isha_angle: settings.isha_angle,
        manual_times: settings.method === 'manual' ? settings.manual_times : null,
      })
      showSnack('Settings saved', 'success')
      await refreshAll()
    } catch (error) {
      showSnack('Unable to save settings', 'error')
    }
  }

  const markPrayer = async (prayerName: string, status?: 'missed') => {
    try {
      const payload: any = {
        date,
        prayer_name: prayerName,
        status: status,
      }
      if (status !== 'missed') {
        payload.completed_at = toLocalIso(new Date())
        if (bucketOverrides[prayerName]) {
          payload.bucket_override = bucketOverrides[prayerName]
        }
      }
      await axios.post(`${apiBase}/prayer/mark`, payload)
      showSnack('Prayer updated', 'success')
      await Promise.all([fetchSchedule(date), fetchSummary(date)])
    } catch (error) {
      showSnack('Unable to update prayer', 'error')
    }
  }

  const toggleDevotion = async (devotion: DevotionStatus) => {
    try {
      const res = await axios.post<DevotionStatus>(`${apiBase}/prayer/devotions/mark`, {
        date,
        key: devotion.key,
        completed: !devotion.completed,
      })
      setDevotions((prev) => prev.map((item) => (item.key === devotion.key ? res.data : item)))
    } catch (error) {
      showSnack('Unable to update devotion', 'error')
    }
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const pushNotification = (title: string, body: string, severity: 'warning' | 'error') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
    showSnack(body, severity)
  }

  const scheduleList = useMemo(() => schedule.slice().sort((a, b) => {
    return PRAYER_ORDER.indexOf(a.prayer_name) - PRAYER_ORDER.indexOf(b.prayer_name)
  }), [schedule])

  useEffect(() => {
    if (!settings || scheduleList.length === 0) return
    const intervalMinutes = Math.max(settings.reminder_interval_minutes, 5)
    const criticalMinutes = Math.max(settings.critical_before_next_minutes, 1)

    const run = () => {
      const now = new Date()
      scheduleList.forEach((entry, index) => {
        if (entry.status === 'completed' || entry.status === 'missed') return
        const scheduledAt = new Date(entry.scheduled_at)
        if (now < scheduledAt) return
        const minutesSince = Math.floor((now.getTime() - scheduledAt.getTime()) / 60000)
        const reminderKey = `${date}-${entry.prayer_name}-rem-${minutesSince}`
        if (minutesSince >= 0 && minutesSince % intervalMinutes === 0 && !remindersSent.current.has(reminderKey)) {
          remindersSent.current.add(reminderKey)
          pushNotification(
            `${PRAYER_LABELS[entry.prayer_name]} reminder`,
            `Time to complete ${PRAYER_LABELS[entry.prayer_name]} (${minutesSince} min since start)`,
            'warning'
          )
        }
        const nextEntry = scheduleList[index + 1]
        const nextPrayerTime = nextEntry
          ? new Date(nextEntry.scheduled_at)
          : tomorrowSchedule.find((item) => item.prayer_name === 'fajr')
            ? new Date(tomorrowSchedule.find((item) => item.prayer_name === 'fajr')!.scheduled_at)
            : null
        if (nextPrayerTime) {
          const criticalStart = new Date(nextPrayerTime.getTime() - criticalMinutes * 60000)
          const criticalKey = `${date}-${entry.prayer_name}-critical`
          if (now >= criticalStart && now < nextPrayerTime && !remindersSent.current.has(criticalKey)) {
            remindersSent.current.add(criticalKey)
            pushNotification(
              `${PRAYER_LABELS[entry.prayer_name]} critical`,
              `${PRAYER_LABELS[entry.prayer_name]} will be missed soon`,
              'error'
            )
          }
        }
      })
    }

    const interval = window.setInterval(run, 60000)
    run()
    return () => window.clearInterval(interval)
  }, [settings, scheduleList, tomorrowSchedule, date])

  const dailyScore = summary?.daily_score ?? 0
  const mtdScore = summary?.mtd_score ?? 0

  if (!settings) {
    return <Typography>Loading prayer settings...</Typography>
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Daily Achievement</Typography>
              <Typography variant="body2" color="text.secondary">Track your prayers with timed thresholds</Typography>
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EmojiEvents color="warning" />
                  <Typography variant="h5">{dailyScore}%</Typography>
                  <Chip label={`MTD ${mtdScore}%`} color="primary" size="small" />
                </Stack>
                <LinearProgress variant="determinate" value={dailyScore} sx={{ mt: 1, height: 8, borderRadius: 5 }} />
              </Box>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Refresh />} variant="outlined" onClick={refreshAll} disabled={loading}>
                Refresh
              </Button>
              <Button variant="contained" onClick={requestNotificationPermission}>
                Enable Notifications
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Typography variant="h6">Prayer Settings</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.method === 'auto'}
                      onChange={(e) => setSettings({ ...settings, method: e.target.checked ? 'auto' : 'manual' })}
                    />
                  }
                  label="Auto prayer times"
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Latitude"
                    type="number"
                    value={settings.latitude ?? ''}
                    onChange={(e) => setSettings({ ...settings, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Longitude"
                    type="number"
                    value={settings.longitude ?? ''}
                    onChange={(e) => setSettings({ ...settings, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                    fullWidth
                    size="small"
                  />
                  <Button variant="outlined" startIcon={<LocationOn />} onClick={handleLocation}>
                    Use
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Timezone offset (min)"
                    type="number"
                    value={settings.timezone_offset_minutes}
                    onChange={(e) => setSettings({ ...settings, timezone_offset_minutes: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Reminder interval (min)"
                    type="number"
                    value={settings.reminder_interval_minutes}
                    onChange={(e) => setSettings({ ...settings, reminder_interval_minutes: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Critical before next (min)"
                    type="number"
                    value={settings.critical_before_next_minutes}
                    onChange={(e) => setSettings({ ...settings, critical_before_next_minutes: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Asr shadow factor"
                    type="number"
                    value={settings.asr_shadow_factor}
                    onChange={(e) => setSettings({ ...settings, asr_shadow_factor: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Fajr angle"
                    type="number"
                    value={settings.fajr_angle}
                    onChange={(e) => setSettings({ ...settings, fajr_angle: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Isha angle"
                    type="number"
                    value={settings.isha_angle}
                    onChange={(e) => setSettings({ ...settings, isha_angle: Number(e.target.value) })}
                    size="small"
                    fullWidth
                  />
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">Manual times</Typography>
                {settings.manual_times && (
                  <Grid container spacing={1}>
                    {Object.entries(PRAYER_LABELS).map(([key, label]) => (
                      <Grid item xs={6} key={key}>
                        <TextField
                          label={label}
                          type="time"
                          value={(settings.manual_times as any)[key]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              manual_times: { ...settings.manual_times, [key]: e.target.value },
                            })
                          }
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
                <Button variant="contained" onClick={saveSettings}>
                  Save Settings
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6">Today Prayer Plan</Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                {scheduleList.map((entry) => (
                  <Card key={entry.prayer_name} variant="outlined">
                    <CardContent>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1">{PRAYER_LABELS[entry.prayer_name]}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Scheduled {formatTime(entry.scheduled_at)}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Chip
                              label={entry.status.toUpperCase()}
                              color={entry.status === 'completed' ? 'success' : entry.status === 'missed' ? 'error' : 'warning'}
                              size="small"
                            />
                            {entry.bucket && <Chip label={BUCKET_LABELS[entry.bucket] || entry.bucket} size="small" />}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            select
                            label="Manual bucket"
                            value={bucketOverrides[entry.prayer_name] || ''}
                            onChange={(e) => setBucketOverrides((prev) => ({ ...prev, [entry.prayer_name]: e.target.value }))}
                            size="small"
                            sx={{ minWidth: 160 }}
                          >
                            <MenuItem value="">Auto</MenuItem>
                            {Object.entries(BUCKET_LABELS).map(([key, label]) => (
                              <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                          </TextField>
                          <Button variant="contained" onClick={() => markPrayer(entry.prayer_name)}>
                            Mark Done
                          </Button>
                          <Button variant="outlined" color="error" onClick={() => markPrayer(entry.prayer_name, 'missed')}>
                            Missed
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6">Daily Counts</Typography>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Chip label={`Completed ${summary?.counts.completed ?? 0}`} color="success" />
                  <Chip label={`Missed ${summary?.counts.missed ?? 0}`} color="error" />
                  <Chip label={`Pending ${summary?.counts.pending ?? 0}`} color="warning" />
                  <Chip label={`1st hr ${summary?.counts.first_hour ?? 0}`} />
                  <Chip label={`2nd hr ${summary?.counts.second_hour ?? 0}`} />
                  <Chip label={`3rd hr ${summary?.counts.third_hour ?? 0}`} />
                  <Chip label={`After ${summary?.counts.after_time ?? 0}`} />
                  <Chip label={`With next ${summary?.counts.with_next ?? 0}`} />
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6">Extra Devotions</Typography>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={1}>
                  {devotions.map((devotion) => (
                    <Card key={devotion.key} variant="outlined">
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2">{devotion.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {devotion.completed ? 'Completed' : 'Pending'}
                            </Typography>
                          </Box>
                          <Button
                            variant={devotion.completed ? 'contained' : 'outlined'}
                            color={devotion.completed ? 'success' : 'primary'}
                            onClick={() => toggleDevotion(devotion)}
                          >
                            {devotion.completed ? 'Done' : 'Mark'}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <SimpleLineChart
                title="Weekly success"
                data={(summary?.weekly ?? []).map((item) => ({
                  label: item.date,
                  value: item.score,
                }))}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <SimpleLineChart
                title="Monthly success"
                data={(summary?.monthly ?? []).map((item) => ({
                  label: item.date,
                  value: item.score,
                }))}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack((prev) => ({ ...prev, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack((prev) => ({ ...prev, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default PrayerDashboard
