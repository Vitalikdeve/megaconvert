import 'core-js/stable'
import 'regenerator-runtime/runtime'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AuthModalProvider from './features/auth/components/AuthModalProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import './i18n.js'
import './design-tokens.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthModalProvider>
            <App />
          </AuthModalProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
