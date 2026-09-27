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

// Las pantallas se bajan cuando se abren (App.jsx). Si mientras alguien tenía
// la app abierta salió una versión nueva, el pedazo viejo ya no está en el
// servidor: se recarga una vez para traer la versión nueva. La marca evita
// quedar recargando en círculo si el problema es otro (sin conexión, etc.).
window.addEventListener('vite:preloadError', (evento) => {
  try {
    if (sessionStorage.getItem('recargaPorVersion')) return
    sessionStorage.setItem('recargaPorVersion', '1')
  } catch {
    return
  }
  evento.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  // Pasado un rato sin errores, la próxima versión nueva puede volver a recargar.
  setTimeout(() => {
    try { sessionStorage.removeItem('recargaPorVersion') } catch { /* sin storage */ }
  }, 10000)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Fuera de App: sale igual en el celular, en el login y en el 404. */}
    <AvisoVersionNueva />
    <App />
  </StrictMode>,
)
