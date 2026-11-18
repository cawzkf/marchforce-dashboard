import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/league-spartan/600.css'
import '@fontsource/league-spartan/700.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import App from './App'
import './app.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
