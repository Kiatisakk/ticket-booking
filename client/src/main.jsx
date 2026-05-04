import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { BookingProvider } from './context/BookingContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AdminAuthProvider>
        <BookingProvider>
          <App />
        </BookingProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </StrictMode>,
)
