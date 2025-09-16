import React, { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Grid, Chip, Stack } from '@mui/material'
import axios from 'axios'

const ManagerDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    const fetchSummary = async () => {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE || ''}/manager/summary`)
      setSummary(res.data)
    }
    fetchSummary()
  }, [])

  if (!summary) return <Typography>Loading...</Typography>

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6">Totals (90 days)</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={`Total ${summary.totals.total}`} />
              <Chip color="error" label={`Detractors ${summary.totals.detractors}`} />
              <Chip color="warning" label={`Passives ${summary.totals.passives}`} />
              <Chip color="success" label={`Promoters ${summary.totals.promoters}`} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6">Recent Chats</Typography>
            {summary.recent_chats.map((c: any, i: number) => (
              <Typography key={i}>{c.sessionId} - {new Date(c.lastMessageAt).toLocaleString()}</Typography>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default ManagerDashboard

