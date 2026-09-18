import { Routes, Route } from 'react-router'
import Landing from './pages/Landing'
import TheApp from './pages/TheApp'
import { DocsSite } from './docs/DocsSite'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<TheApp />} />
      <Route path="/docs" element={<DocsSite />} />
      <Route path="/docs/:slug" element={<DocsSite />} />
    </Routes>
  )
}
