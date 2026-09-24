import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import App from './App.jsx'
import AvisoVersionNueva from './components/shared/AvisoVersionNueva.jsx'
import { instalarFetchConToken } from './utils/fetchConToken'

// Antes de montar la app: desde acá toda llamada a /api sale con el token.
instalarFetchConToken()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Fuera de App: sale igual en el celular, en el login y en el 404. */}
    <AvisoVersionNueva />
    <App />
  </StrictMode>,
)
