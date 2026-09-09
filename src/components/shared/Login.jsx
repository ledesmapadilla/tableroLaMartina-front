import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, Form, Button } from 'react-bootstrap'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/login', form)
      login(data.token, { nombre: data.nombre, usuario: data.usuario, rol: data.rol })
      // Vuelve a donde se quiso entrar; si se llego al login directo, al inicio.
      navigate(location.state?.desde || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    // El login es la puerta del proyecto entero, no de una sección. Va en verde
    // claro: es la primera pantalla y conviene que sea liviana, no el oscuro de
    // la página principal.
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Verde de pasto, no menta: los verdes de la escala del #1b4332 tienen
        // el tono en 150° y se leen celestes. Estos están en 90°, del lado del
        // amarillo, que es lo que se lee como verde sin dudar.
        background: 'linear-gradient(135deg, #eef6e6 0%, #d7e9c3 50%, #b5d99c 100%)',
        height: '100%',
        padding: '1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 330 }}>
        <div className="text-center mb-4">
          <img
            src="/logo-la-martina.png"
            alt="La Martina"
            style={{
              maxWidth: 200,
              width: '60%',
              maskImage:
                'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'destination-in',
            }}
          />
          <div
            className="fw-bold mt-2"
            style={{ fontSize: '0.9rem', letterSpacing: '4px', textTransform: 'uppercase', color: '#1b4332' }}
          >
            Tablero de control
          </div>
        </div>

        <Card className="border-0 shadow-lg rounded-4">
          <Card.Body className="px-4 py-3">
            <div
              className="fw-bold text-center mb-4"
              style={{ fontSize: '0.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#334155' }}
            >
              Iniciar sesión
            </div>

            <Form onSubmit={handleSubmit}>
              <Form.Label className="fw-semibold text-dark small mb-1">Usuario</Form.Label>
              <Form.Control
                type="text"
                size="sm"
                className="rounded-3 mb-3"
                style={{ fontSize: '0.85rem', height: '34px' }}
                value={form.usuario}
                onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
                autoFocus
                autoComplete="username"
              />

              <Form.Label className="fw-semibold text-dark small mb-1">Contraseña</Form.Label>
              <Form.Control
                type="password"
                size="sm"
                className="rounded-3 mb-4"
                style={{ fontSize: '0.85rem', height: '34px' }}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
              />

              {error && (
                <div
                  className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 mb-3"
                  style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.82rem' }}
                >
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-100 rounded-3 py-1 shadow-sm d-flex align-items-center justify-content-center gap-2"
                style={{ backgroundColor: '#1b4332', borderColor: '#1b4332', fontSize: '0.86rem', fontWeight: 600, height: '36px' }}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-box-arrow-in-right"></i>
                )}
                <span>Ingresar</span>
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}
