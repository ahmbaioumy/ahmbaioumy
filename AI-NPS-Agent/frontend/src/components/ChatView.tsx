import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Card, CardContent, TextField, Typography, Stack, Chip, Divider } from '@mui/material'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/chat'

type ChatMessage = {
  id?: number
  sender: 'agent' | 'customer' | 'system'
  content: string
  timestamp?: string
  sentiment?: number
  risk?: number
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('Hello, I need help with my order.')
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string>(`demo-${Math.random().toString(36).slice(2,8)}`)

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionIdRef.current}`)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message') {
        setMessages((prev) => [...prev, { ...data.message }])
      }
      if (data.type === 'alert') {
        const msg = `Detractor risk ${(data.risk*100).toFixed(0)}%, sentiment ${(data.sentiment).toFixed(2)}`
        window.dispatchEvent(new CustomEvent('nps-alert', { detail: msg }))
      }
    }
    wsRef.current = ws
    return () => { ws.close() }
  }, [])

  const send = (sender: 'agent' | 'customer') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ sender, content: input }))
    setInput('')
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6">Session: {sessionIdRef.current}</Typography>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={1} sx={{ maxHeight: 320, overflow: 'auto' }}>
            {messages.map((m, idx) => (
              <Box key={idx}>
                <Typography variant="body2"><b>{m.sender}</b>: {m.content}</Typography>
                {(m.sentiment !== undefined || m.risk !== undefined) && (
                  <Stack direction="row" spacing={1}>
                    {m.sentiment !== undefined && <Chip size="small" label={`sent ${m.sentiment.toFixed(2)}`} />}
                    {m.risk !== undefined && <Chip size="small" color={m.risk >= 0.6 ? 'error' : 'default'} label={`risk ${(m.risk*100).toFixed(0)}%`} />}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField fullWidth value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" />
            <Button variant="contained" onClick={() => send('customer')}>Send as Customer</Button>
            <Button variant="outlined" onClick={() => send('agent')}>Send as Agent</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default ChatView

