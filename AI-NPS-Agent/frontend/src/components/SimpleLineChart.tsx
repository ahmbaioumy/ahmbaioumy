import React from 'react'
import { Box, Typography } from '@mui/material'

type DataPoint = {
  label: string
  value: number
}

type SimpleLineChartProps = {
  data: DataPoint[]
  height?: number
  title?: string
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, height = 160, title }) => {
  const values = data.map((d) => d.value)
  const maxValue = Math.max(10, ...values)
  const points = data.map((point, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
    const y = 100 - (point.value / maxValue) * 100
    return { x, y }
  })

  const path = points.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <Box>
      {title && <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>}
      <svg viewBox="0 0 100 100" width="100%" height={height}>
        <line x1="0" y1="100" x2="100" y2="100" stroke="#e0e0e0" strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2="100" stroke="#e0e0e0" strokeWidth="1" />
        <path d={path} fill="none" stroke="#1976d2" strokeWidth="2" />
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="2.2" fill="#1976d2" />
        ))}
      </svg>
    </Box>
  )
}

export default SimpleLineChart
