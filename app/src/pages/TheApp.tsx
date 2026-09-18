import { useNavigate } from 'react-router'
import { ThemeProvider } from '@/lib/theme'
import { AppShell } from '@/app/AppShell'

/** The dashboard app — lives ONLY on /app. Back returns to the landing (/). */
export default function TheApp() {
  const nav = useNavigate()
  return (
    <ThemeProvider>
      <AppShell onBack={() => nav('/')} onDocs={() => nav('/docs')} />
    </ThemeProvider>
  )
}
