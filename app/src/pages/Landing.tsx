import { useNavigate } from 'react-router'
import { DarkLanding } from '@/landing/DarkLanding'

/** Marketing site — lives ONLY on /. The app lives on /app. */
export default function Landing() {
  const nav = useNavigate()
  return <DarkLanding onEnter={() => nav('/app')} />
}
