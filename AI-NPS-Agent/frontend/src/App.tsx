import React, { useEffect } from 'react'
import { AppBar, Toolbar, Typography, Container, Box, Button, Snackbar, Alert, Tabs, Tab } from '@mui/material'
import { useAuthStore } from './store/auth'
import ChatView from './components/ChatView'
import ManagerDashboard from './components/ManagerDashboard'

const App: React.FC = () => {
  const { token, loginMock, logout, role } = useAuthStore()
  const [tab, setTab] = React.useState(0)
  const [alertOpen, setAlertOpen] = React.useState(false)
  const [alertMsg, setAlertMsg] = React.useState('')

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setAlertMsg(e.detail)
      setAlertOpen(true)
    }
    window.addEventListener('nps-alert' as any, handler as any)
    return () => window.removeEventListener('nps-alert' as any, handler as any)
  }, [])

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>AI NPS Assistant</Typography>
          {token ? (
            <>
              <Typography sx={{ mr: 2 }}>{role}</Typography>
              <Button color="inherit" onClick={logout}>Logout</Button>
            </>
          ) : (
            <Button color="inherit" onClick={() => loginMock('agent@example.com', 'password')}>Login</Button>
          )}
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 3 }}>
        {token ? (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Chat" />
              <Tab label="Manager" />
            </Tabs>
            <Box sx={{ mt: 2 }}>
              {tab === 0 && <ChatView />}
              {tab === 1 && <ManagerDashboard />}
            </Box>
          </>
        ) : (
          <Typography>Login to start</Typography>
        )}
      </Container>
      <Snackbar open={alertOpen} autoHideDuration={5000} onClose={() => setAlertOpen(false)}>
        <Alert onClose={() => setAlertOpen(false)} severity="warning" sx={{ width: '100%' }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App

