import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div className="text-center mb-4">
          <img src="/logo LM-transp.png" alt="Logo La Martina" style={{ maxWidth: 180, width: '60%' }} />
          <p style={{ marginTop: 8, fontWeight: 700, fontSize: 16, letterSpacing: 5, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            La Martina
          </p>
        </div>

        <div className="card" style={{ border: '1px solid #000' }}>
          <div className="card-body p-4">
            <h6 className="card-title mb-4 text-center" style={{ fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>
              Iniciar sesión
            </h6>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: 13, fontWeight: 500 }}>Usuario</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ border: '1px solid #000' }}
                  value={form.usuario}
                  onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="mb-4">
                <label className="form-label" style={{ fontSize: 13, fontWeight: 500 }}>Contraseña</label>
                <input
                  type="password"
                  className="form-control"
                  style={{ border: '1px solid #000' }}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-dark w-100"
                disabled={loading}
              >
                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                Ingresar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
