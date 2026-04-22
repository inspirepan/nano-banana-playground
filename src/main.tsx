import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/work-sans/index.css'
import './index.css'
import App from './App.tsx'
import { initRipple } from './lib/ripple'

initRipple()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
