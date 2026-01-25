import { createRoot } from 'react-dom/client'
import './index.scss'
import App from './App.tsx'
import { CookiesProvider } from 'react-cookie'
import { BrowserRouter } from 'react-router'
import { ThemeProvider } from './components/theme-provider'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <CookiesProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CookiesProvider>
  </ThemeProvider>
)


