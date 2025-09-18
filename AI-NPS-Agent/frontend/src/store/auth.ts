import create from 'zustand'
import axios from 'axios'

type AuthState = {
  token: string | null
  role: string
  loginMock: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: 'agent',
  loginMock: async (username: string, password: string) => {
    const res = await axios.post(`${import.meta.env.VITE_API_BASE || ''}/auth/login`, { username, password })
    const token = res.data.access_token
    set({ token, role: username.endsWith('@manager') ? 'manager' : 'agent' })
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  },
  logout: () => {
    set({ token: null, role: 'agent' })
    delete axios.defaults.headers.common['Authorization']
  }
}))

