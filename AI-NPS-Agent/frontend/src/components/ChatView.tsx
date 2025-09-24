import React, { useEffect, useRef, useState } from 'react'
import { 
  Box, Button, Card, CardContent, TextField, Typography, Stack, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, IconButton, Tooltip
} from '@mui/material'
import { Warning, CheckCircle, Cancel, Refresh } from '@mui/icons-material'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/chat'

type ChatMessage = {
  id?: number
  sender: 'agent' | 'customer' | 'system'
  content: string
  timestamp?: string
  sentiment?: number
  risk?: number
}

type AIRecommendation = {
  id: string
  suggestedResponse: string
  riskLevel: number
  sentiment: number
  reasoning: string
  timestamp: string
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('Hello, I need help with my order.')
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string>(`demo-${Math.random().toString(36).slice(2,8)}`)
  
  // AI Recommendation popup state
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [showRecommendationDialog, setShowRecommendationDialog] = useState(false)
  const [pendingRecommendation, setPendingRecommendation] = useState<string>('')

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
      if (data.type === 'ai_recommendation') {
        // Show AI recommendation popup
        const recommendation: AIRecommendation = {
          id: data.id || `rec-${Date.now()}`,
          suggestedResponse: data.suggestedResponse || "I understand your concern. Let me help you resolve this issue.",
          riskLevel: data.risk || 0.7,
          sentiment: data.sentiment || -0.5,
          reasoning: data.reasoning || "Customer appears frustrated. Suggest empathetic response with clear resolution steps.",
          timestamp: new Date().toISOString()
        }
        setAiRecommendation(recommendation)
        setShowRecommendationDialog(true)
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

  // AI Recommendation handlers
  const handleApproveRecommendation = () => {
    if (aiRecommendation && wsRef.current) {
      // Send the approved AI recommendation as agent message
      wsRef.current.send(JSON.stringify({ 
        sender: 'agent', 
        content: aiRecommendation.suggestedResponse,
        aiApproved: true,
        recommendationId: aiRecommendation.id
      }))
      setShowRecommendationDialog(false)
      setAiRecommendation(null)
    }
  }

  const handleRejectRecommendation = () => {
    setShowRecommendationDialog(false)
    setAiRecommendation(null)
  }

  const handleRequestAlternative = () => {
    if (aiRecommendation && wsRef.current) {
      // Request alternative recommendation
      wsRef.current.send(JSON.stringify({ 
        type: 'request_alternative',
        recommendationId: aiRecommendation.id,
        currentRisk: aiRecommendation.riskLevel
      }))
      setShowRecommendationDialog(false)
      setAiRecommendation(null)
    }
  }

  const handleEditRecommendation = () => {
    if (aiRecommendation) {
      setPendingRecommendation(aiRecommendation.suggestedResponse)
      setShowRecommendationDialog(false)
    }
  }

  const sendEditedRecommendation = () => {
    if (pendingRecommendation && wsRef.current) {
      wsRef.current.send(JSON.stringify({ 
        sender: 'agent', 
        content: pendingRecommendation,
        aiEdited: true,
        originalRecommendationId: aiRecommendation?.id
      }))
      setPendingRecommendation('')
      setAiRecommendation(null)
    }
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
          
          {/* AI Recommendation Edit Interface */}
          {pendingRecommendation && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Edit AI Recommendation:</Typography>
              <TextField 
                fullWidth 
                multiline 
                rows={3}
                value={pendingRecommendation} 
                onChange={(e) => setPendingRecommendation(e.target.value)} 
                placeholder="Edit the AI recommendation..."
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button variant="contained" size="small" onClick={sendEditedRecommendation}>
                  Send Edited Response
                </Button>
                <Button variant="outlined" size="small" onClick={() => setPendingRecommendation('')}>
                  Cancel
                </Button>
              </Stack>
            </Box>
          )}
          
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField fullWidth value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" />
            <Button variant="contained" onClick={() => send('customer')}>Send as Customer</Button>
            <Button variant="outlined" onClick={() => send('agent')}>Send as Agent</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* AI Recommendation Dialog */}
      <Dialog open={showRecommendationDialog} onClose={handleRejectRecommendation} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Warning color="warning" />
            <Typography variant="h6">AI Recommendation</Typography>
            <Chip 
              label={`Risk: ${(aiRecommendation?.riskLevel * 100).toFixed(0)}%`} 
              color={aiRecommendation?.riskLevel >= 0.6 ? 'error' : 'warning'}
              size="small"
            />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>AI Analysis:</strong> {aiRecommendation?.reasoning}
            </Typography>
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Suggested Response:</Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2 }}>
            <Typography variant="body1">{aiRecommendation?.suggestedResponse}</Typography>
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Sentiment Score: {aiRecommendation?.sentiment.toFixed(2)} | 
            Generated: {new Date(aiRecommendation?.timestamp || '').toLocaleTimeString()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRejectRecommendation} startIcon={<Cancel />}>
            Reject
          </Button>
          <Button onClick={handleRequestAlternative} startIcon={<Refresh />}>
            Request Alternative
          </Button>
          <Button onClick={handleEditRecommendation} variant="outlined">
            Edit
          </Button>
          <Button onClick={handleApproveRecommendation} variant="contained" startIcon={<CheckCircle />}>
            Approve & Send
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default ChatView

